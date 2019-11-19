/* Copyright 2019 Edouard Maleix, read LICENSE */

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
      connectTimeout: 2 * 1000,
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
      //  console.log('parseAloesAppMessage:req', topic, payload.toString());
      let params = null;
      if (mqttPattern.matches(aloesProtocol.collectionPatternIn, topic)) {
        params = mqttPattern.exec(aloesProtocol.collectionPatternIn, topic);
      } else if (mqttPattern.matches(aloesProtocol.instancePatternIn, topic)) {
        params = mqttPattern.exec(aloesProtocol.instancePatternIn, topic);
      }
      if (!params || params === null) {
        console.log('parseAloesAppMessage:err', 'Invalid pattern');
        return null;
      }

      const methodExists = aloesProtocol.validators.methods.some(meth => meth === params.method);
      const collectionExists = aloesProtocol.validators.collections.some(
        name => name === params.collection,
      );

      payload = payload.toString();
      console.log('parseAloesAppMessage:res', params);

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
          case 'measurement':
            return null;
          case 'scheduler':
            return null;
          default:
            return null;
        }
        if (Model && Model !== null) {
          return Model.emit('publish', { topic, payload, params });
        }
        return null;
      }
      console.log('parseAloesAppMessage:err', 'Invalid method / collection');
      return null;
    };

    const setAloesState = async () => {
      try {
        const aloesServer = app.datasources.aloesServer;
        const Application = app.models.Application;
        const Device = app.models.Device;
        const Sensor = app.models.Sensor;
        const aloesState = await aloesServer.getApplicationState(applicationId);
        console.log('setAloesState:res', aloesState);

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
              return null;
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
        console.log('setAloesState:err', error);
        return null;
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
        const aloesClient = await mqtt.connectAsync(process.env.ALOES_MQTT_URL, mqttOptions);

        app.aloesClient = aloesClient;
        await aloesClient.subscribe(`${applicationId}/#`, { qos: 1 });
        app.emit('ready:aloes-client', aloesClient, application, true);

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
        aloesClient.on('reconnect', () => {
          console.log('aloesClient reconnecting');
          // app.aloesClient = aloesClient;
          // app.emit('ready:aloes-client', aloesClient, application, state);
        });

        /**
         * @event module:aloesClient~disconnect
         * @param {object} state - Connection status
         * @fires module:app~stopped:aloes-client
         */
        aloesClient.on('offline', state => {
          console.log('aloesClient disconnected');
          // if (app.aloesClient) delete app.aloesClient;
          app.emit('stopped:aloes-client', state);
        });

        /**
         * @event module:aloesClient~message
         * @param {object} topic - MQTT Topic
         * @param {object} message - MQTT Payload
         * @returns {function} parseBrokerMessage
         */
        // aloesClient.on('message', parseAloesAppMessage);

        const handleMessage = (packet, cb) => {
          try {
            parseAloesAppMessage(packet.topic, packet.payload);
            cb();
          } catch (e) {
            cb();
          }
        };

        aloesClient.handleMessage = handleMessage;

        return aloesClient;
      } catch (error) {
        console.log('on:ready:lora-server:err', error);
        return null;
      }
    });

    return app;
  } catch (error) {
    app.emit('error:aloes-client', error);
    return null;
  }
}
