/* eslint-disable no-param-reassign */
import fs from 'fs';
import util from 'util';
import mqttPattern from 'mqtt-pattern';
import loraProtocol from '../initial-data/lora-app-protocol';

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

  //  LoraApplication.once('dataSourceAttached', () => {
  LoraApplication.once('ready:lora-rest', LoraRest => {
    const find = async applicationId =>
      new Promise((resolve, reject) => {
        LoraRest.connector.find(collectionName, applicationId, (err, res) =>
          err ? reject(err) : resolve(res.application),
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
        LoraRest.connector.save(collectionName, instance, (err, res) =>
          err ? reject(err) : resolve(res.deviceProfile),
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
        LoraRest.connector.destroy(collectionName, id, (err, res) =>
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
  });

  LoraApplication.once('ready:lora-client', LoraClient => {
    LoraApplication.publish = async (loraDevice, payload) => {
      try {
        const params = {
          method: 'tx',
          collection: 'application',
          instanceId: loraDevice.applicationID,
          devEui: loraDevice.devEUI,
        };
        const topic = await mqttPattern.fill(loraProtocol.devicePattern, params);
        console.log(`${collectionName} - publish : `, topic, payload);
        await LoraClient.publish(topic, JSON.stringify(payload), { qos: 0 });
        return { topic, payload };
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
        aloesDevice.lastSignal = new Date();
        await Device.publish(aloesDevice, 'HEAD');
        return aloesDevice;
      } catch (error) {
        return error;
      }
    };

    LoraApplication.on('publish', async message => {
      try {
        //  const Device = LoraApplication.app.models.Device;
        const Sensor = LoraApplication.app.models.Sensor;
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
            await Sensor.loraToAloes(loraDevice);
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
