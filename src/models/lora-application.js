/* eslint-disable no-param-reassign */
import fs from 'fs';
import util from 'util';
import { startCase } from 'lodash';
import { aloesLightDecoder } from 'aloes-light-handlers';
import { omaObjects } from 'oma-json';

//  import loraProtocol from '../initial-data/lora-app-protocol';

/**
 * @module LoraApplication
 * @property {String} id  MAC Address
 * @property {String} name Unique name defined by user required.
 * @property {String} networkServerID
 * @property {String} organizationID
 */
module.exports = function(LoraApplication) {
  const collectionName = 'LoraApplication';

  LoraApplication.disableRemoteMethodByName('exists');
  LoraApplication.disableRemoteMethodByName('upsert');
  LoraApplication.disableRemoteMethodByName('replaceOrCreate');
  //  LoraApplication.disableRemoteMethodByName('prototype.updateAttributes');
  //  LoraApplication.disableRemoteMethodByName('prototype.patchAttributes');
  LoraApplication.disableRemoteMethodByName('createChangeStream');

  LoraApplication.on('dataSourceAttached', () => {
    const find = async applicationId =>
      new Promise((resolve, reject) => {
        LoraApplication.app.datasources.loraRest.connector.find(
          collectionName,
          applicationId,
          (err, res) => (err ? reject(err) : resolve(res.application)),
        );
      });

    LoraApplication.findById = async applicationId => {
      try {
        if (!applicationId || applicationId === null) {
          return null;
        }
        const application = await find(applicationId);
        //  console.log(`${collectionName}-findById:res`, application);
        return application;
      } catch (error) {
        console.log(`${collectionName}-findById:err`, error);
        return error;
      }
    };

    const save = async instance =>
      new Promise((resolve, reject) => {
        LoraApplication.app.datasources.loraRest.connector.save(
          collectionName,
          instance,
          (err, res) => (err ? reject(err) : resolve(res.deviceProfile)),
        );
      });

    LoraApplication.updateById = async (applicationId, application) => {
      try {
        if (!applicationId || !application.application) {
          return null;
        }
        if (!application.id) {
          //  application.application.id = applicationId;
          application.id = applicationId;
        }
        await save(application);
        application = await LoraApplication.findById(applicationId);
        //  console.log(`${collectionName}-updateById res`, application);
        return application;
      } catch (error) {
        console.log(`${collectionName}-updateById err`, error);
        return error;
      }
    };

    LoraApplication.replaceOrCreate = async application => {
      try {
        if (!application.application) {
          return null;
        }
        if (!application.application.id) {
          const result = await LoraApplication.create(application);
          application = result.application;
          application = await LoraApplication.findById(result.application);
        } else {
          application = await LoraApplication.updateById(application.application.id, application);
        }
        console.log(`${collectionName}-replaceOrCreate res`, application);
        return application;
      } catch (error) {
        console.log(`${collectionName}-replaceOrCreate err`, error);
        return error;
      }
    };

    const destroyById = async id =>
      new Promise((resolve, reject) => {
        LoraApplication.app.datasources.loraRest.connector.destroy(collectionName, id, (err, res) =>
          err ? reject(err) : resolve(res),
        );
      });

    LoraApplication.deleteById = async applicationId => {
      try {
        // const ConnectorModel = LoraApplication.app.datasources.loraRest.connector;
        // await ConnectorModel.destroy(collectionName, applicationId);
        await destroyById(applicationId);
        console.log(`${collectionName}-deleteById res`, applicationId);
        return applicationId;
      } catch (error) {
        console.log(`${collectionName}-deleteById err`, error);
        return error;
      }
    };

    const compose = async (protocol, index) => {
      try {
        const readFile = util.promisify(fs.readFile);
        const organizationID = process.env.LORA_ORGANIZATION_ID;
        const serviceProfileID = process.env.LORA_SERVICE_PROFILE_ID;
        if (!organizationID || !serviceProfileID) return null;
        let application = {};
        let payloadCodec = '';
        let payloadEncoderScript = '';
        let payloadDecoderScript = '';
        let name = null;

        if (protocol.search(/cayenne/i) !== -1) {
          payloadCodec = 'CAYENNE_LPP';
          name = protocol;
        } else if (protocol.search(/js/i) !== -1) {
          payloadCodec = 'CUSTOM_JS';
          const encoder = await readFile(`${__dirname}/../initial-data/encoder-${index}.js`);
          const decoder = await readFile(`${__dirname}/../initial-data/decoder-${index}.js`);
          // console.log('encoder', JSON.stringify(encoder.toString()));
          // console.log('encoder', JSON.stringify(encoder));
          //  console.log('encoder', encoder.toString());
          payloadEncoderScript = encoder.toString();
          payloadDecoderScript = decoder.toString();
          name = `${protocol}_${index}`;
        } else {
          name = `${protocol}`;
        }
        // console.log(`${collectionName}-compose req name`, name);

        const applications = await LoraApplication.find({
          limit: 2,
          organizationID,
          search: name,
        });

        if (!applications || applications.totalCount === '0') {
          application = {
            name,
            organizationID,
            description: 'automatically generated app by aloes',
            payloadCodec,
            payloadEncoderScript,
            payloadDecoderScript,
            serviceProfileID,
          };
          application = await LoraApplication.replaceOrCreate({ application });
        } else {
          application = applications.result[0];
          application.payloadCodec = payloadCodec;
          application.payloadEncoderScript = payloadEncoderScript;
          application.payloadDecoderScript = payloadDecoderScript;
          if (application.payloadCodec === 'CUSTOM_JS') {
            await LoraApplication.updateById(application.id, { application });
          }
        }
        console.log(`${collectionName}-compose elem res`, index, application);
        return application;
      } catch (error) {
        console.log(`${collectionName}-compose elem err`, error);
        return error;
      }
    };

    LoraApplication.compose = async protocols => {
      try {
        console.log(`${collectionName}-compose req`, protocols);
        if (typeof protocols === 'string') {
          protocols = [protocols];
        }
        const promises = await protocols.map(compose);
        const result = await Promise.all(promises);
        return result;
      } catch (error) {
        console.log(`${collectionName}-compose err`, error);
        return error;
      }
    };

    const parseCayennePayload = async (loraDevice, aloesDevice) => {
      try {
        const Sensor = LoraApplication.app.models.Sensor;

        const sensorTypes = Object.keys(loraDevice.object);
        console.log('parseCayennePayload : ', sensorTypes);

        const promises = await sensorTypes.map(async type => {
          try {
            const omaObjectName = startCase(type);
            console.log('omaObjectName : ', omaObjectName);
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
                console.log('aloesSensor : ', value, omaObject.value, omaResourceId, aloesSensor);

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
                  aloesSensor.resources[omaResourceId] = value;
                  aloesSensor.transportProtocol = aloesDevice.transportProtocol;
                  aloesSensor.transportProtocolVersion = aloesDevice.transportProtocolVersion;
                  aloesSensor.messageProtocol = aloesDevice.messageProtocol;
                  aloesSensor.messageProtocolVersion = aloesDevice.messageProtocolVersion;
                  await Sensor.publish(aloesSensor, 'HEAD');
                } else {
                  // todo detect presentation messages
                  // const params = {
                  //   method: '1',
                  //   sensorId: id,
                  //   prefixedDevEui: `${aloesDevice.devEui}-out`,
                  //   omaObjectId: aloesSensor.type.toString(),
                  //   omaResourceId,
                  // };
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

    const parsePayload = async device => {
      try {
        const Device = LoraApplication.app.models.Device;
        const aloesDevice = await Device.findOne({
          where: { devEui: { regexp: new RegExp(`.*${device.devEUI}.*`, 'i') } },
        });
        //  console.log('aloesDevice : ', aloesDevice);
        if (!aloesDevice || aloesDevice === null) throw new Error('No aloes device found');
        if (!device.object) throw new Error('Lora payload not decoded, add a handler');
        if (device.applicationName.search(/cayenne/i) !== -1) {
          await parseCayennePayload(device, aloesDevice);
        }
        aloesDevice.frameCounter = device.fCnt;
        aloesDevice.status = true;
        await Device.publish(aloesDevice, 'PUT');
        return aloesDevice;
      } catch (error) {
        return error;
      }
    };

    const parseJoin = async device => {
      try {
        const Device = LoraApplication.app.models.Device;
        const aloesDevice = await Device.findOne({
          where: { devEui: { regexp: new RegExp(`.*${device.devEUI}.*`, 'i') } },
        });
        //  console.log(`${collectionName} - aloesDevice : `, aloesDevice);
        if (!aloesDevice || aloesDevice === null) throw new Error('No aloes device found');
        aloesDevice.status = true;
        aloesDevice.frameCounter = 0;
        await Device.publish(aloesDevice, 'HEAD');
        return aloesDevice;
      } catch (error) {
        return error;
      }
    };

    LoraApplication.on('publish', async message => {
      try {
        const loraDevice = JSON.parse(message.payload);
        const topic = message.topic;
        const params = message.params;

        if (!topic || !loraDevice || !params || !params.method) throw new Error('Invalid message');
        console.log(`${collectionName} - published:${params.method}`, loraDevice);

        switch (params.method) {
          case 'join':
            await parseJoin(loraDevice);
            break;
          case 'rx':
            await parsePayload(loraDevice);
            break;
          case 'tx':
            break;
          case 'status':
            break;
          case 'ack':
            break;
          case 'error':
            break;
          default:
            throw new Error('Wrong method');
        }
        return message;
      } catch (error) {
        return error;
      }
    });
  });
};
