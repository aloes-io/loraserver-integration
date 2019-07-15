/* eslint-disable no-param-reassign */
import { camelCase } from 'lodash';
//  import loraProtocol from '../initial-data/lora-app-protocol';
import mqttPattern from 'mqtt-pattern';
import aloesProtocol from '../initial-data/aloes-protocol';

/**
 * @module Sensor
 * @property {String} id  Database generated ID.
 * @property {String} name required.
 * @property {String} devEui hardware generated Device Id required.
 * @property {Date} lastSignal
 * @property {Date} lastSync last date when this sensor cache was synced
 * @property {Number} frameCounter Number of messages since last connection
 * @property {String} type OMA object ID, used to format resources schema
 * @property {String} resource OMA resource ID used for last message
 * @property {Array} resources OMA Resources ( formatted object where sensor value and settings are stored )
 * @property {Array} icons OMA Object icons URL
 * @property {Object} colors OMA Resource colors
 * @property {String} transportProtocol Framework used for message transportation
 * @property {String} transportProtocolVersion Framework version
 * @property {String} messageProtocol Framework used for message encoding
 * @property {String} messageProtocolVersion Framework version
 * @property {String} nativeSensorId Original sensor id ( stringified integer )
 * @property {String} [nativeNodeId] Original node id ( stringified integer )
 * @property {String} nativeType Original sensor type identifier
 * @property {String} nativeResource Original sensor variables identifier
 * @property {String} ownerId User ID of the developer who registers the application.
 * @property {String} deviceId Device instance Id which has sent this measurement
 */
module.exports = function(Sensor) {
  const collectionName = 'Sensor';

  Sensor.validatesPresenceOf('ownerId');
  Sensor.validatesPresenceOf('deviceId');

  Sensor.disableRemoteMethodByName('exists');
  Sensor.disableRemoteMethodByName('upsert');
  Sensor.disableRemoteMethodByName('replaceOrCreate');
  //  Sensor.disableRemoteMethodByName('prototype.updateAttributes');
  //  Sensor.disableRemoteMethodByName('prototype.patchAttributes');
  Sensor.disableRemoteMethodByName('createChangeStream');

  Sensor.on('publish', async message => {
    try {
      const sensor = JSON.parse(message.payload);
      const topic = message.topic;
      const params = message.params;
      if (!topic || !sensor || !params || !params.method) throw new Error('Invalid message');
      console.log(`${collectionName} - received : `, params, sensor);

      const loraDevice = await Sensor.app.models.LoraDevice.get(sensor.devEui);
      console.log(' lora device ', loraDevice);
      if (!loraDevice || loraDevice === null) throw new Error('No lora device found');

      const key = camelCase(sensor.name);
      console.log('sensor name ', key);
      switch (params.method.toUpperCase()) {
        case 'HEAD':
          break;
        case 'GET':
          break;
        case 'POST':
          // if method === post create new device on lora app
          break;
        case 'PUT':
          // convert packet and publish to LoraDevice
          break;
        case 'DELETE':
          break;
        default:
          throw new Error('Wrong method');
      }
      return message;
    } catch (error) {
      return error;
    }
  });

  Sensor.publish = async (sensor, method) => {
    try {
      console.log(`${collectionName} - publish : `, method);
      if (Sensor.app.aloesClient) {
        let patternName = aloesProtocol.collectionPattern;
        const params = {
          applicationId: process.env.APPLICATION_ID,
          collection: collectionName,
          //  collection: 'IoTAgent',
          method,
        };
        if (sensor.id) {
          params.modelId = sensor.id;
          patternName = aloesProtocol.instancePattern;
        }
        const topic = await mqttPattern.fill(patternName, params);
        console.log(`${collectionName} - publish:res `, topic, sensor);
        // await Sensor.app.loraClient.publish(loraTopic, payload, { qos: 0 });
        // return { topic, payload };
      }
      return null;
    } catch (error) {
      return error;
    }
  };
};
