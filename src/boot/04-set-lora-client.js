import mqtt from 'async-mqtt';
import mqttPattern from 'mqtt-pattern';
import loraProtocol from '../initial-data/lora-app-protocol';

export default async function setLoraClient(app) {
  try {
    const mqttOptions = {
      protocolId: 'MQTT',
      protocolVersion: 4,
      reconnectPeriod: 5000,
      connectTimeout: 30 * 1000,
      clean: true,
      clientId: `${process.env.APPLICATION_ID}-${Math.random()
        .toString(16)
        .substr(2, 8)}`,
      // username: process.env.LORA_MQTT_USER,
      // password: process.env.LORA_MQTT_PASS,
    };

    const removeDuplicateUsingFilter = arr =>
      arr.filter((elem, index, self) => index === self.indexOf(elem));

    const setLoraState = async aloesApp => {
      try {
        let appList = [];
        if (!aloesApp.devices || !aloesApp.devices.length) return appList;
        const loraDevicesPromises = await aloesApp.devices.map(async aloesDevice => {
          try {
            const LoraApplication = app.models.LoraApplication;
            const applications = await LoraApplication.compose(aloesDevice.messageProtocol);
            const loraApp = applications[0];
            if (loraApp.payloadCodec === 'CUSTOM_JS') {
              await LoraApplication.updateById(loraApp.id, { application: loraApp });
            }
            const LoraDeviceProfile = app.models.LoraDeviceProfile;
            const deviceProfile = await LoraDeviceProfile.compose(
              loraApp,
              aloesDevice,
            );
            // add loraDevices if not existing
            const LoraDevice = app.models.LoraDevice;
            const loraDevice = await LoraDevice.compose(
              aloesDevice,
              loraApp.id,
              deviceProfile,
            );

            return loraDevice.applicationID;
          } catch (error) {
            return error;
          }
        });

        const loraAppIds = await Promise.all(loraDevicesPromises);
        if (loraAppIds && loraAppIds.length > 0) {
          //  appList = loraDevices.map(device => device.applicationID);
          appList = removeDuplicateUsingFilter(loraAppIds);
        }
        return appList;
      } catch (error) {
        return error;
      }
    };

    /**
     * Parse internal application messages coming from LoraWan Broker
     * @param {string} topic - MQTT topic
     * @param {object} payload - MQTT payload
     * @fires module:Model~publish
     */
    const parseLoraAppMessage = async (topic, payload) => {
      try {
        //  console.log('parseLoraAppMessage:req', topic);
        let params = null;
        let Model;
        if (mqttPattern.matches(loraProtocol.pattern, topic)) {
          params = mqttPattern.exec(loraProtocol.pattern, topic);
          Model = app.models.LoraGateway;
        } else if (mqttPattern.matches(loraProtocol.devicePattern, topic)) {
          params = mqttPattern.exec(loraProtocol.devicePattern, topic);
          Model = app.models.LoraApplication;
        }
        if (!params || params === null) {
          throw new Error('Error: Invalid pattern');
        }
        const methodExists = loraProtocol.validators.methods.some(meth => meth === params.method);
        const collectionExists = loraProtocol.validators.collections.some(
          name => name === params.collection,
        );
        console.log('parseLoraAppMessage:res', params);

        payload = payload.toString();
        if (methodExists && collectionExists) {
          await Model.emit('publish', { topic, payload, params });
        }
        return null;
        //  throw new Error('Error: Invalid pattern');
      } catch (error) {
        //  console.log('parseLoraAppMessage:err', error);
        return error;
      }
    };

    // store conf ?
    //  app.once('ready:lora-server', async loraConf => {});

    // on aloes-client ready  check device-profiles
    // compare with stored aloes devices
    app.once('ready:aloes-client', async (aloesClient, aloesApp) => {
      try {
        //  console.log('on:ready:aloes-client', aloesApp.name);
        console.log('on:ready:aloes-client', aloesApp.name);
        const appList = await setLoraState(aloesApp);

        /**
         * MQTT.JS Client.
         * @module loraClient
         */
        const loraClient = mqtt.connect(process.env.LORA_MQTT_URL, mqttOptions);

        /**
         * @event module:loraClient~error
         * @param {object} error - Connection error
         * @fires module:app~error:lora-client
         */
        loraClient.on('error', err => app.emit('error:lora-client', err));

        /**
         * @event module:loraClient~connect
         * @param {object} state - Connection status
         * @fires module:app~stopped:lora-client
         */
        loraClient.on('connect', async state => {
          try {
            console.log('loraClient connected');
            app.loraClient = loraClient;
            if (appList && appList !== null) {
              console.log('subscribing to : ', appList);
              const supbPromises = await appList.map(async appId =>
                loraClient.subscribe(`application/${appId}/#`, { qos: 0 }),
              );
              await Promise.all(supbPromises);
            }
            //  await loraClient.subscribe(`application/#`, { qos: 0 });
            return app.emit('ready:lora-client', loraClient, state);
          } catch (error) {
            return error;
          }
        });

        /**
         * @event module:loraClient~disconnect
         * @param {object} state - Connection status
         * @fires module:app~stopped:lora-client
         */
        loraClient.on('offline', async state => {
          try {
            console.log('loraClient disconnected');
            if (appList && appList !== null) {
              console.log('unsubscribing from: ', appList);
              const supbPromises = await appList.map(async appId =>
                loraClient.unsubscribe(`application/${appId}/#`),
              );
              await Promise.all(supbPromises);
            }
            delete app.loraClient;
            return app.emit('stopped:lora-client', state);
          } catch (error) {
            return error;
          }
        });

        /**
         * @event module:aloesClient~message
         * @param {object} topic - MQTT Topic
         * @param {object} message - MQTT Payload
         * @returns {function} parseBrokerMessage
         */
        loraClient.on('message', async (topic, payload) => parseLoraAppMessage(topic, payload));
        return loraClient;
      } catch (error) {
        return error;
      }
    });

    return app;
  } catch (error) {
    app.emit('error:lora-client', error);
    return error;
  }
}
