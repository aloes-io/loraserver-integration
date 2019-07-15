import mqtt from 'async-mqtt';
import mqttPattern from 'mqtt-pattern';
import aloesProtocol from '../initial-data/aloes-protocol';

export default async function setAloesClient(app) {
  try {
    const applicationId = process.env.APPLICATION_ID;
    const apiKey = process.env.APPLICATION_KEY;
    const mqttOptions = {
      protocolId: 'MQTT',
      protocolVersion: 4,
      reconnectPeriod: 1000,
      connectTimeout: 30 * 1000,
      clean: false,
      clientId: `${applicationId}-${Math.random()
        .toString(16)
        .substr(2, 8)}`,
      username: applicationId,
      password: apiKey,
    };

    /**
     * Parse message coming from Aloes broker
     * @param {string} topic - MQTT topic
     * @param {object} payload - MQTT payload
     * @fires module:Model~publish
     */
    const parseAloesAppMessage = (topic, payload) => {
      try {
        //  console.log('parseAloesAppMessage:req', topic, payload.toString());
        let params = null;
        if (mqttPattern.matches(aloesProtocol.collectionPattern, topic)) {
          params = mqttPattern.exec(aloesProtocol.collectionPattern, topic);
        } else if (mqttPattern.matches(aloesProtocol.instancePattern, topic)) {
          params = mqttPattern.exec(aloesProtocol.instancePattern, topic);
        }
        if (!params || params === null) {
          throw new Error('Error: Invalid pattern');
        }

        const methodExists = aloesProtocol.validators.methods.some(meth => meth === params.method);
        const collectionExists = aloesProtocol.validators.collections.some(
          name => name === params.collection,
        );

        payload = payload.toString();
        //  console.log('parseAloesAppMessage:res', params);

        if (methodExists && collectionExists) {
          let Model;
          switch (params.collection.toLowerCase()) {
            case 'iotagent':
              //  return onPublish(message);
              break;
            case 'application':
              Model = app.models.Application;
              break;
            case 'device':
              Model = app.models.Device;
              break;
            case 'sensor':
              Model = app.models.Sensor;
              break;
            default:
              throw new Error('Comment est-ce possible?');
          }
          if (Model && Model !== null) {
            return Model.emit('publish', { topic, payload, params });
          }
          return null;
        }
        throw new Error('Error: Invalid pattern');
      } catch (error) {
        return error;
      }
    };

    const setAloesState = async () => {
      try {
        const aloesServer = app.datasources.aloesServer;
        const Application = app.models.Application;
        const Device = app.models.Device;
        const Sensor = app.models.Sensor;
        const aloesState = await aloesServer.getApplicationState(applicationId);
        //  console.log('APP state :', application);
        if (!aloesState || aloesState === null) return null;
        if (aloesState.devices && aloesState.devices.length > 0) {
          const devices = aloesState.devices;
          const sensorPromises = await devices.map(async device => {
            try {
              if (device.sensors && device.sensors.length > 0) {
                await device.sensors.map(async sensor => Sensor.replaceOrCreate(sensor));
              }
              delete device.sensors;
              return null;
            } catch (error) {
              return error;
            }
          });
          await Promise.all(sensorPromises);
          const devicePromises = await devices.map(async device => Device.replaceOrCreate(device));
          await Promise.all(devicePromises);
        }
        const application = JSON.parse(JSON.stringify(aloesState));
        delete application.devices;
        await Application.replaceOrCreate(application);
        return aloesState;
      } catch (error) {
        return error;
      }
    };

    app.once('ready:lora-server', async loraConf => {
      try {
        console.log('on:ready:lora-server', loraConf);
        const application = await setAloesState();

        /**
         * MQTT.JS Client.
         * @module aloesClient
         */
        const aloesClient = mqtt.connect(process.env.ALOES_MQTT_URL, mqttOptions);

        /**
         * @event module:aloesClient~error
         * @param {object} error - Connection error
         * @fires module:app~error:aloes-client
         */
        aloesClient.on('error', err => app.emit('error:aloes-client', err));

        /**
         * @event module:aloesClient~connect
         * @param {object} state - Connection status
         * @fires module:app~ready:aloes-client
         */
        aloesClient.on('connect', async state => {
          try {
            console.log('aloesClient connected');
            app.aloesClient = aloesClient;
            await aloesClient.subscribe(`${applicationId}/#`, { qos: 1 });
            return app.emit('ready:aloes-client', application, loraConf, state);
          } catch (error) {
            console.log('error', error);
            return error;
          }
        });

        /**
         * @event module:aloesClient~disconnect
         * @param {object} state - Connection status
         * @fires module:app~stopped:aloes-client
         */
        aloesClient.on('offline', async state => {
          try {
            console.log('aloesClient disconnected');
            delete app.aloesClient;
            return app.emit('stopped:aloes-client', state);
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
        aloesClient.on('message', async (topic, payload) => parseAloesAppMessage(topic, payload));

        return aloesClient;
      } catch (error) {
        return error;
      }
    });

    return app;
  } catch (error) {
    app.emit('error:aloes-client', error);
    return error;
  }
}
