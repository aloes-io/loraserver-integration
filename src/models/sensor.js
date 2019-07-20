/* eslint-disable no-param-reassign */
import { camelCase, startCase } from 'lodash';
import { aloesLightDecoder } from 'aloes-light-handlers';
import { omaObjects } from 'oma-json';
//  import loraProtocol from '../initial-data/lora-app-protocol';
import { cayenneEncoder } from 'cayennelpp-handlers';
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

  const buildCayennePayload = async aloesSensor => {
    try {
      const payload = {
        confirmed: false, // whether the payload must be sent as confirmed data down or not
        fPort: 2,
        data: 'aGVsbG8=', // base64 encoded data
        // object: {
        //   // decoded object (when application encoder has been configured)
        //   temperatureSensor: { '1': 25 }, // when providing the 'object', you can omit 'data'
        //   humiditySensor: { '1': 32 },
        // },
      };
      console.log('cayenne payload req');
      const object = await cayenneEncoder(aloesSensor);
      console.log('cayenne payload', camelCase(aloesSensor.name), object);
      return payload;
    } catch (error) {
      console.log('cayenne payload err', error);
      return error;
    }
  };

  const parseCayennePayload = async (loraDevice, aloesDevice) => {
    try {
      const sensorTypes = Object.keys(loraDevice.object);
      console.log('parseCayennePayload : ', sensorTypes);

      const promises = await sensorTypes.map(async type => {
        try {
          const omaObjectName = startCase(type);
          //  console.log('omaObjectName : ', omaObjectName);
          const sensorIds = Object.keys(loraDevice.object[type]);
          const updateSensors = await sensorIds.map(async id => {
            try {
              //  { transportProtocol: { regexp: new RegExp(`.*${aloesDevice.transportProtocol}.*`, 'i') } }
              //  { messageProtocol: { regexp: new RegExp(`.*${aloesDevice.messageProtocol}.*`, 'i') } }
              //  { messageProtocol: { regexp: new RegExp(`.*${device.applicationName}.*`, 'i') } }
              const filter = {
                where: {
                  and: [
                    { nativeSensorId: id },
                    { name: { regexp: new RegExp(`.*${omaObjectName}.*`, 'i') } },
                    { devEui: { regexp: new RegExp(`.*${aloesDevice.devEui}.*`, 'i') } },
                  ],
                },
              };
              // console.log('filter', filter.where.and);

              let aloesSensor = await Sensor.findOne(filter);
              const omaObject = omaObjects.find(obj => obj.name === omaObjectName);
              const omaResourceId = omaObject.resourceIds.split(',')[0].toString();
              const value = loraDevice.object[type][id];
              console.log(
                'aloesSensor : ',
                value,
                omaObject.value,
                omaResourceId,
                aloesSensor.name,
              );

              if (!aloesSensor || aloesSensor === null) {
                const params = {
                  method: '0',
                  sensorId: id,
                  prefixedDevEui: `${aloesDevice.devEui}-out`,
                  omaObjectId: omaObject.value.toString(),
                  omaResourceId,
                };
                aloesSensor = aloesLightDecoder({ payload: value }, params);
                aloesSensor.method = 'HEAD';
                aloesSensor.frameCounter = loraDevice.fCnt;
                aloesSensor.resources[omaResourceId] = value;
                aloesSensor.transportProtocol = aloesDevice.transportProtocol;
                aloesSensor.transportProtocolVersion = aloesDevice.transportProtocolVersion;
                aloesSensor.messageProtocol = aloesDevice.messageProtocol;
                aloesSensor.messageProtocolVersion = aloesDevice.messageProtocolVersion;
                await Sensor.publish(aloesSensor, 'HEAD');
              } else {
                // todo detect presentation messages
                aloesSensor.frameCounter = loraDevice.fCnt;
                aloesSensor.lastSignal = new Date();
                aloesSensor.value = value.toString();
                aloesSensor.resource = omaResourceId;
                aloesSensor.resources[omaResourceId] = value;
                aloesSensor.method = 'PUT';
                // console.log('aloesSensor : ', aloesSensor);
                await Sensor.publish(aloesSensor, 'PUT');
              }
              return aloesSensor;
            } catch (error) {
              return error;
            }
          });
          const result = await Promise.all(updateSensors);
          return result;
        } catch (error) {
          return error;
        }
      });
      const result = await Promise.all(promises);
      return result;
    } catch (error) {
      return error;
    }
  };

  Sensor.loraToAloes = async loraDevice => {
    try {
      const Device = Sensor.app.models.Device;
      const aloesDevice = await Device.findOne({
        where: { devEui: { regexp: new RegExp(`.*${loraDevice.devEUI}.*`, 'i') } },
      });
      //  console.log('aloesDevice : ', aloesDevice);
      if (!aloesDevice || aloesDevice === null) throw new Error('No aloes device found');
      if (loraDevice.applicationName.search(/cayenne/i) !== -1) {
        await parseCayennePayload(loraDevice, aloesDevice);
      } else if (loraDevice.applicationName.search(/js/i) !== -1) {
        //  await parseJSPayload(loraDevice, aloesDevice);
      }
      //  if (!loraDevice.object) throw new Error('Lora payload not decoded, add a handler');
      aloesDevice.frameCounter = loraDevice.fCnt;
      aloesDevice.status = true;
      aloesDevice.lastSignal = new Date();
      await Device.publish(aloesDevice, 'PUT');
      return aloesDevice;
    } catch (error) {
      return error;
    }
  };

  Sensor.aloesToLora = async aloesSensor => {
    try {
      const LoraDevice = Sensor.app.models.LoraDevice;
      const loraDevice = await LoraDevice.get(aloesSensor.devEui);
      console.log('aloes sensor to lora device ', loraDevice);
      if (!loraDevice || loraDevice === null) throw new Error('No lora device found');
      let payload;

      if (aloesSensor.messageProtocol.search(/cayenne/i) !== -1) {
        payload = await buildCayennePayload(aloesSensor);
      } else if (aloesSensor.messageProtocol.search(/js/i) !== -1) {
        //  await parseJSPayload(loraDevice, aloesDevice);
      }
      if (payload && payload !== null) await LoraDevice.publish(loraDevice, payload);

      return loraDevice;
    } catch (error) {
      return error;
    }
  };

  Sensor.once('ready:aloes-client', AloesClient => {
    Sensor.publish = async (sensor, method) => {
      try {
        console.log(`${collectionName} - publish : `, method);
        let pattern = aloesProtocol.collectionPatternOut;
        const params = {
          applicationEui: process.env.APPLICATION_EUI,
          collection: collectionName,
          method,
        };
        if (sensor.id) {
          params.modelId = sensor.id;
          pattern = aloesProtocol.instancePatternOut;
        }
        const topic = await mqttPattern.fill(pattern, params);
        console.log(`${collectionName} - publish:res `, topic, sensor.name);
        const payload = JSON.stringify(sensor);
        await AloesClient.publish(topic, payload, { qos: 0 });
        return { topic, payload };
      } catch (error) {
        return error;
      }
    };

    Sensor.on('publish', async message => {
      try {
        const sensor = JSON.parse(message.payload);
        const topic = message.topic;
        const params = message.params;
        if (!topic || !sensor || !params || !params.method) throw new Error('Invalid message');
        console.log(`${collectionName} - received : `, params, sensor.name);
        switch (params.method.toUpperCase()) {
          case 'HEAD':
            await Sensor.replaceOrCreate(sensor);
            break;
          case 'GET':
            await Sensor.replaceOrCreate(sensor);
            break;
          case 'POST':
            await Sensor.replaceOrCreate(sensor);
            await Sensor.aloesToLora(sensor);
            break;
          case 'PUT':
            await Sensor.replaceOrCreate(sensor);
            await Sensor.aloesToLora(sensor);
            break;
          case 'DELETE':
            await Sensor.deleteById(sensor.id);
            break;
          case 'ERROR':
            break;
          default:
            throw new Error('Wrong method');
        }
        return message;
      } catch (error) {
        console.log(`${collectionName} - on publish:err : `, error);
        return error;
      }
    });
  });
};
