/* Copyright 2019 Edouard Maleix, read LICENSE */

import mqtt from 'async-mqtt';
import mqttPattern from 'mqtt-pattern';
import loraProtocol from '../initial-data/lora-app-protocol';

export default async function setLoraClient(app) {
  try {
    const mqttOptions = {
      protocolId: 'MQTT',
      protocolVersion: 4,
      reconnectPeriod: 1000,
      connectTimeout: 2 * 1000,
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
            return null;
          }
        });
        const loraAppIds = await Promise.all(loraDevicesPromises);
        if (loraAppIds && loraAppIds.length > 0) {
          appList = removeDuplicateUsingFilter(loraAppIds);
        }
        console.log('setLoraState:res', appList);
        return appList;
      } catch (error) {
        console.log('setLoraState:err', error);
        return null;
      }
    };

    /**
     * Parse internal application messages coming from LoraWan Broker
     * @param {string} topic - MQTT topic
     * @param {object} payload - MQTT payload
     * @fires module:Model~publish
     */
    const parseLoraAppMessage = (topic, payload) => {
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
        console.log('parseLoraAppMessage:err', 'Invalid pattern');
        return null;
      }
      const methodExists = loraProtocol.validators.methods.some(meth => meth === params.method);
      const collectionExists = loraProtocol.validators.collections.some(
        name => name === params.collection,
      );
      console.log('parseLoraAppMessage:res', params);

      payload = payload.toString();
      if (methodExists && collectionExists) {
        return Model.emit('publish', { topic, payload, params });
      }
      console.log('parseLoraAppMessage:err', 'Invalid method / collection');
      return null;
    };

    // store conf ?
    //  app.once('ready:lora-server', async loraConf => {});

    // on aloes-client ready  check device-profiles
    // compare with stored aloes devices
    app.once('ready:aloes-client', async (aloesClient, aloesApp) => {
      try {
        const appList = await setLoraState(aloesApp);

        /**
         * MQTT.JS Client.
         * @module loraClient
         */
        const loraClient = await mqtt.connectAsync(process.env.LORA_MQTT_URL, mqttOptions);
        app.loraClient = loraClient;

        if (appList && appList !== null) {
          console.log('subscribing to : ', appList);
          const supbPromises = await appList.map(async appId =>
            loraClient.subscribe(`application/${appId}/#`, { qos: 0 }),
          );
          await Promise.all(supbPromises);
        }

        //  await loraClient.subscribe(`application/#`, { qos: 0 });
        app.emit('ready:lora-client', loraClient, true);

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
        loraClient.on('reconnect', () => {
          console.log('loraClient reconnecting');
          // app.loraClient = loraClient;
          // app.emit('ready:lora-client', loraClient, state);
        });

        /**
         * @event module:loraClient~disconnect
         * @param {object} state - Connection status
         * @fires module:app~stopped:lora-client
         */
        loraClient.on('offline', state => {
          console.log('loraClient disconnected');
          // if (appList && appList !== null) {
          //   console.log('unsubscribing from: ', appList);
          //   const supbPromises = await appList.map(async appId =>
          //     loraClient.unsubscribe(`application/${appId}/#`),
          //   );
          //   await Promise.all(supbPromises);
          // }
          // if (app.loraClient) delete app.loraClient;
          app.emit('stopped:lora-client', state);
        });

        /**
         * @event module:aloesClient~message
         * @param {object} topic - MQTT Topic
         * @param {object} message - MQTT Payload
         * @returns {function} parseBrokerMessage
         */
        // loraClient.on('message', parseLoraAppMessage);

        const handleMessage = (packet, cb) => {
          try {
            parseLoraAppMessage(packet.topic, packet.payload);
            cb();
          } catch (e) {
            cb();
          }
        };

        loraClient.handleMessage = handleMessage;

        return loraClient;
      } catch (error) {
        console.log('on:ready:aloes-client:err', error);
        return null;
      }
    });

    return app;
  } catch (error) {
    app.emit('error:lora-client', error);
    return null;
  }
}
