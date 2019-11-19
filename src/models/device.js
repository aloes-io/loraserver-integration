/* Copyright 2019 Edouard Maleix, read LICENSE */

import mqttPattern from 'mqtt-pattern';
import aloesProtocol from '../initial-data/aloes-protocol';

/**
 * @module Device
 * @property {String} id  Database generated ID.
 * @property {String} name Unique name defined by user required.
 * @property {String} description Define device purpose.
 * @property {String} devEui hardware generated Device Id required.
 * @property {String} devAddr randomly generated non unique Device Id required.
 * @property {String} apiKey key to access Aloes as client.
 * @property {String} clientKey key to access Aloes as client.
 * @property {Date} lastSignal
 * @property {Number} frameCounter Number of messages since last connection
 * @property {String} type Device type ( /initial-data/device-types.json )
 * @property {Array} icons automatically set based on device type
 * @property {String} accessPointUrl
 * @property {String} qrCode Filled URL containing device access point
 * @property {String} transportProtocol Framework used for message transportation
 * @property {String} transportProtocolVersion Framework version
 * @property {String} messageProtocol Framework used for message encoding
 * @property {String} messageProtocolVersion Framework version
 * @property {Array} collaborators Used to share access to other users
 * @property {String} ownerId User ID of the user who has registered the device.
 */
module.exports = function(Device) {
  const collectionName = 'Device';

  Device.validatesPresenceOf('ownerId');
  Device.validatesUniquenessOf('devEui');

  Device.disableRemoteMethodByName('exists');
  Device.disableRemoteMethodByName('upsert');
  Device.disableRemoteMethodByName('replaceOrCreate');
  //  Device.disableRemoteMethodByName('prototype.updateAttributes');
  //  Device.disableRemoteMethodByName('prototype.patchAttributes');
  Device.disableRemoteMethodByName('createChangeStream');

  Device.once('ready:aloes-client', AloesClient => {
    Device.publish = async (device, method) => {
      try {
        let pattern = aloesProtocol.collectionPatternOut;
        const params = {
          applicationEui: process.env.APPLICATION_EUI,
          collection: collectionName,
          //  collection: 'IoTAgent',
          method,
        };
        if (device.id) {
          params.modelId = device.id;
          pattern = aloesProtocol.instancePatternOut;
        }
        const topic = await mqttPattern.fill(pattern, params);
        console.log(`${collectionName} - publish:res `, topic, device.name);
        const payload = JSON.stringify(device);
        await AloesClient.publish(topic, payload, { qos: 0 });
        return { topic, payload };
      } catch (error) {
        console.log(`${collectionName} - publish:err `, error);
        throw error;
      }
    };

    Device.on('publish', async message => {
      try {
        const device = JSON.parse(message.payload);
        const topic = message.topic;
        const params = message.params;
        if (!topic || !device || !params || !params.method) throw new Error('Invalid message');
        console.log(`${collectionName} - on-publish:req `, params, device.name);
        const loraDevice = await Device.app.models.LoraDevice.findById(device.devEui);
        //  console.log(' lora device ', loraDevice);
        if (!loraDevice || !loraDevice.devEUI) throw new Error('No lora device found');
        switch (params.method.toUpperCase()) {
          case 'HEAD':
            await Device.replaceOrCreate(device);
            break;
          case 'GET':
            await Device.replaceOrCreate(device);
            break;
          case 'POST':
            await Device.replaceOrCreate(device);
            // if method === post, findOrCreate needed profile create new device on lora app
            break;
          case 'PUT':
            await Device.replaceOrCreate(device);
            break;
          case 'DELETE':
            await Device.deleteById(device.id);
            break;
          case 'ERROR':
            break;
          default:
            throw new Error('Wrong method');
        }
        return message;
      } catch (error) {
        console.log(`${collectionName} - on-publish:err `, error);
        return null;
      }
    });
  });
};
