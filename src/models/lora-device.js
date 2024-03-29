/* Copyright 2019 Edouard Maleix, read LICENSE */

/**
 * @module LoraDevice
 * @property {String} id  Database generated ID.
 * @property {String} name Unique name defined by user required.
 * @property {String} description Define device purpose.
 * @property {String} devEUI hardware generated Device Id required.
 * @property {String} applicationID
 * @property {String} deviceProfileID
 * @property {Number} referenceAltitude
 * @property {Boolean} skipFCntCheck
 */

module.exports = function(LoraDevice) {
  const collectionName = 'LoraDevice';

  LoraDevice.disableRemoteMethodByName('exists');
  LoraDevice.disableRemoteMethodByName('upsert');
  LoraDevice.disableRemoteMethodByName('replaceOrCreate');
  //  LoraDevice.disableRemoteMethodByName('prototype.updateAttributes');
  //  LoraDevice.disableRemoteMethodByName('prototype.patchAttributes');
  LoraDevice.disableRemoteMethodByName('createChangeStream');

  LoraDevice.once('ready:lora-rest', (LoraRest, LoraServer) => {
    LoraDevice.findById = async deviceDevEui => {
      try {
        if (!deviceDevEui || deviceDevEui === null) {
          return null;
        }
        let device;
        const devices = await LoraDevice.find({
          limit: 1,
          search: deviceDevEui,
        });
        if (!devices || devices.totalCount === 0) {
          device = null;
        } else {
          device = devices.result[0];
        }
        return device;
      } catch (error) {
        throw error;
      }
    };

    /**
     * Helper for gateway saving
     * @method module:LoraGateway~save
     * @param {object} instance - Gateway instance { gateway : {}}
     * @returns {promise}  LoraGateway.app.datasources.loraRest.connector.destroy
     */
    const save = async instance =>
      new Promise((resolve, reject) => {
        LoraRest.connector.save(collectionName, instance, (err, res) =>
          err ? reject(err) : resolve(res),
        );
      });

    LoraDevice.updateById = async (deviceDevEui, device) => {
      try {
        if (!deviceDevEui || deviceDevEui === null || !device.device) {
          return null;
        }
        if (!device.id) {
          //  device.device.id = deviceDevEui;
          //  device.devEUI = deviceDevEui;
          device.id = deviceDevEui;
        }
        await save(device);
        device = await LoraDevice.findById(deviceDevEui);
        //  console.log(`${collectionName}-updateById:res`, device);
        return device;
      } catch (error) {
        console.log(`${collectionName}-updateById:err`, error);
        throw error;
      }
    };

    LoraDevice.replaceOrCreate = async device => {
      try {
        if (!device.device) {
          return null;
        }
        if (!device.device.id) {
          const result = await LoraDevice.create(device);
          device = result.device;
          device = await LoraDevice.findById(result.device);
        } else {
          device = await LoraDevice.updateById(device.device.id, device);
        }
        //  console.log(`${collectionName}-replaceOrCreate res`, device);
        return device;
      } catch (error) {
        console.log(`${collectionName}-replaceOrCreate err`, error);
        throw error;
      }
    };
    /**
     * Helper for device deletion
     * @method module:LoraDevice~destroyById
     * @param {string} id -Device devEUI
     * @returns {promise}  LoraDevice.app.datasources.loraRest.connector.destroy
     */
    const destroyById = async id =>
      new Promise((resolve, reject) => {
        LoraRest.connector.destroy(collectionName, id, (err, res) =>
          err ? reject(err) : resolve(res),
        );
      });

    LoraDevice.deleteById = async deviceDevEui => {
      try {
        await destroyById(deviceDevEui);
        console.log(`${collectionName}-deleteById res`);
        return deviceDevEui;
      } catch (error) {
        console.log(`${collectionName}-deleteById err`, error);
        throw error;
      }
    };

    const getKeys = async deviceDevEui => {
      const token = process.env.LORA_HTTP_TOKEN;
      return new Promise((resolve, reject) => {
        LoraServer.getDeviceKeys(token, deviceDevEui, (err, res) =>
          err ? reject(err) : resolve(res.deviceKeys),
        );
      });
    };

    LoraDevice.getKeys = async deviceDevEui => {
      try {
        const deviceKeys = await getKeys(deviceDevEui);
        console.log(`${collectionName}-getKeys:res`, deviceKeys);
        //   const res = await loraServer.getDeviceKeys(token, deviceDevEui);
        if (!deviceKeys || deviceKeys instanceof Error) return null;
        return deviceKeys;
      } catch (error) {
        //  console.log(`${collectionName}-getKeys err`, error);
        throw error;
      }
    };

    LoraDevice.createKeys = async (deviceDevEui, keys) => {
      try {
        // if (macVersion === "")keys.nwkKey
        console.log(`${collectionName}-createKeys:req`, keys);
        if (!keys || !keys.deviceKeys || !keys.deviceKeys.nwkKey || !keys.deviceKeys.devEUI) {
          return null;
        }
        const token = process.env.LORA_HTTP_TOKEN;
        const deviceKeys = await LoraServer.createDeviceKeys(token, deviceDevEui, keys);
        console.log(`${collectionName}-createKeys:res`, deviceKeys);
        return deviceKeys;
      } catch (error) {
        console.log(`${collectionName}-createKeys:err`, error);
        throw error;
      }
    };

    LoraDevice.updateKeys = async (deviceDevEui, keys) => {
      try {
        if (!keys || !keys.appKey || !keys.devEUI || !keys.nwkKey) return null;
        const token = process.env.LORA_HTTP_TOKEN;
        await LoraServer.updateDeviceKeys(token, deviceDevEui, keys);
        console.log(`${collectionName}-updateKeys:res`, keys);
        return keys;
      } catch (error) {
        console.log(`${collectionName}-updateKeys:err`, error);
        throw error;
      }
    };

    const getActivation = async deviceDevEui => {
      const token = process.env.LORA_HTTP_TOKEN;
      return new Promise((resolve, reject) => {
        LoraServer.getDeviceActivation(token, deviceDevEui, (err, res) =>
          err ? reject(err) : resolve(res.deviceActivation),
        );
      });
    };

    LoraDevice.getActivation = async deviceDevEui => {
      try {
        const deviceActivation = await getActivation(deviceDevEui);
        if (!deviceActivation || deviceActivation instanceof Error) return null;
        console.log(`${collectionName}-getActivation res`, deviceActivation);
        return deviceActivation;
      } catch (error) {
        //  console.log(`${collectionName}-getActivation err`, error);
        throw error;
      }
    };

    const activate = async (deviceDevEui, deviceActivation) => {
      const token = process.env.LORA_HTTP_TOKEN;
      return new Promise((resolve, reject) => {
        LoraServer.activateDevice(token, deviceDevEui, deviceActivation, (err, res) =>
          err ? reject(err) : resolve(res),
        );
      });
    };

    LoraDevice.activate = async (deviceDevEui, deviceActivation) => {
      try {
        if (
          !deviceActivation ||
          !deviceActivation.deviceActivation ||
          !deviceActivation.deviceActivation.appSKey ||
          !deviceActivation.deviceActivation.devEUI ||
          !deviceActivation.deviceActivation.devAddr ||
          !deviceActivation.deviceActivation.nwkSEncKey ||
          !deviceActivation.deviceActivation.sNwkSIntKey ||
          !deviceActivation.deviceActivation.fNwkSIntKey
        ) {
          return null;
        }
        await activate(deviceDevEui, deviceActivation);
        console.log(`${collectionName}-activate res`, deviceActivation);
        return deviceActivation;
      } catch (error) {
        console.log(`${collectionName}-activate err`, error);
        throw error;
      }
    };

    LoraDevice.compose = async (aloesDevice, loraAppId, deviceProfile) => {
      try {
        let device = await LoraDevice.findById(aloesDevice.devEui);
        //  console.log('foundDevice:req', device);
        const description =
          aloesDevice.description || `${aloesDevice.name} ${aloesDevice.authMode}`;
        if (!device || !device.devEUI || !device.applicationID || device instanceof Error) {
          device = {
            name: aloesDevice.name,
            description,
            deviceProfileID: deviceProfile.id,
            referenceAltitude: false,
            skipFCntCheck: false,
            devEUI: aloesDevice.devEui,
            applicationID: loraAppId,
          };
          const result = await LoraDevice.create({ device });
          if (!result || !result.device) throw new Error('Error while creating device');
          device = await LoraDevice.findById(result.device);
        } else if (device.devEUI && device.applicationID !== loraAppId) {
          await LoraDevice.deleteById(device.devEUI);
          device = {
            name: aloesDevice.name,
            description,
            deviceProfileID: deviceProfile.id,
            referenceAltitude: false,
            skipFCntCheck: false,
            devEUI: aloesDevice.devEui,
            applicationID: loraAppId,
          };
          const result = await LoraDevice.create({ device });
          if (!result || !result.device) {
            throw new Error('Error while creating device');
          }
          device = await LoraDevice.findById(result.device);
        } else {
          let hasChanged = false;
          if (device.name !== aloesDevice.name) {
            hasChanged = true;
            device.name = aloesDevice.name;
          }
          if (device.description !== description) {
            hasChanged = true;
            device.description = description;
          }
          if (device.deviceProfileID !== deviceProfile.id) {
            hasChanged = true;
            device.deviceProfileID = deviceProfile.id;
          }
          if (device.deviceProfileName !== deviceProfile.name) {
            hasChanged = true;
            device.deviceProfileName = deviceProfile.name;
          }
          if (hasChanged) {
            device = await LoraDevice.updateById(device.devEUI, { device });
          }
        }

        // check keys
        if (aloesDevice.authMode === 'OTAA') {
          let deviceKeys = await LoraDevice.getKeys(device.devEUI);
          // check mac version to know wether add nwksey or not
          if (!deviceKeys || !deviceKeys.nwkKey || !deviceKeys.devEUI) {
            if (aloesDevice.appKey && aloesDevice.appKey !== null) {
              deviceKeys = { nwkKey: aloesDevice.appKey.toLowerCase(), devEUI: device.devEUI };
              deviceKeys = await LoraDevice.createKeys(device.devEUI, { deviceKeys });
            }
          }
        } else if (aloesDevice.authMode === 'ABP') {
          let deviceActivation = await LoraDevice.getActivation(device.devEUI);
          if (
            !deviceActivation ||
            !deviceActivation.appSKey ||
            !deviceActivation.devEUI ||
            !deviceActivation.nwkSEncKey
          ) {
            if (
              aloesDevice.appSKey &&
              aloesDevice.appSKey !== null &&
              aloesDevice.nwkSKey &&
              aloesDevice.nwkSKey !== null &&
              aloesDevice.devAddr &&
              aloesDevice.devAddr !== null
            ) {
              deviceActivation = {
                aFCntDown: 0,
                appSKey: aloesDevice.appSKey.toLowerCase(),
                devAddr: aloesDevice.devAddr,
                devEUI: aloesDevice.devEui,
                fCntUp: 0,
                nFCntDown: 0,
                nwkSEncKey: aloesDevice.nwkSKey.toLowerCase(),
                sNwkSIntKey: aloesDevice.nwkSKey.toLowerCase(),
                fNwkSIntKey: aloesDevice.nwkSKey.toLowerCase(),
              };
              deviceActivation = await LoraDevice.activate(device.devEUI, { deviceActivation });
            }
          }
        }
        console.log(`${collectionName}-compose:res`, device);
        return device;
      } catch (error) {
        console.log(`${collectionName}-compose:err`, error);
        throw error;
      }
    };
  });
};
