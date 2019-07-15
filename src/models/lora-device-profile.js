/* eslint-disable no-param-reassign */

/**
 * @module LoraDeviceProfile
 * @property {String} id  MAC Address
 * @property {String} name Unique name defined by user required.
 * @property {String} networkServerID
 * @property {String} organizationID
 */

module.exports = function(LoraDeviceProfile) {
  const collectionName = 'LoraDeviceProfile';

  LoraDeviceProfile.disableRemoteMethodByName('exists');
  LoraDeviceProfile.disableRemoteMethodByName('upsert');
  LoraDeviceProfile.disableRemoteMethodByName('replaceOrCreate');
  //  LoraDeviceProfile.disableRemoteMethodByName('prototype.updateAttributes');
  //  LoraDeviceProfile.disableRemoteMethodByName('prototype.patchAttributes');
  LoraDeviceProfile.disableRemoteMethodByName('createChangeStream');

  LoraDeviceProfile.on('dataSourceAttached', () => {
    /**
     * Helper for gateway find
     * @method module:LoraGateway~save
     * @param {string} id - Gateway MAC address ( hex )
     * @param {object} instance - Gateway instance { gateway : {}}
     * @returns {promise}  LoraGateway.app.datasources.loraRest.connector.destroy
     */
    const find = async deviceProfileId =>
      new Promise((resolve, reject) => {
        LoraDeviceProfile.app.datasources.loraRest.connector.find(
          collectionName,
          deviceProfileId,
          (err, res) => (err ? reject(err) : resolve(res.deviceProfile)),
        );
      });

    LoraDeviceProfile.findById = async deviceProfileId => {
      try {
        if (!deviceProfileId || deviceProfileId === null) {
          return null;
        }
        const deviceProfile = await find(deviceProfileId);
        //  console.log(`${collectionName}-findById:res`, deviceProfile);
        return deviceProfile;
      } catch (error) {
        console.log(`${collectionName}-findById:err`, error);
        return error;
      }
    };

    /**
     * Helper for gateway saving
     * @method module:LoraGateway~save
     * @param {string} id - Gateway MAC address ( hex )
     * @param {object} instance - Gateway instance { gateway : {}}
     * @returns {promise}  LoraGateway.app.datasources.loraRest.connector.destroy
     */
    const save = async deviceProfile =>
      new Promise((resolve, reject) => {
        LoraDeviceProfile.app.datasources.loraRest.connector.save(
          collectionName,
          deviceProfile,
          (err, res) => (err ? reject(err) : resolve(res.deviceProfile)),
        );
      });

    LoraDeviceProfile.updateById = async (deviceProfileId, deviceProfile) => {
      try {
        if (!deviceProfileId || !deviceProfile.deviceProfile) {
          return null;
        }
        if (!deviceProfile.id) {
          //  deviceProfile.deviceProfile.id = deviceProfileId;
          deviceProfile.id = deviceProfileId;
        }
        await save(deviceProfile);
        deviceProfile = await LoraDeviceProfile.findById(deviceProfileId);
        //  console.log(`${collectionName}-updateById:res`, deviceProfile);
        return deviceProfile;
      } catch (error) {
        console.log(`${collectionName}-updateById:err`, error);
        return error;
      }
    };

    const compose = async (loraApp, aloesDevice) => {
      try {
        const networkServerID = process.env.LORA_NETWORK_SERVER_ID;
        if (!networkServerID) return null;
        // todo get macVersion, rfRegion from Aloes
        let deviceProfile = {
          macVersion: '1.0.3',
          //  macVersion: aloesDevice.macVersion || '1.0.3',
          regParamsRevision: 'A',
          rfRegion: 'EU868',
          supports32BitFCnt: false,
          supportsClassB: false,
          supportsClassC: false,
          organizationID: loraApp.organizationID,
          networkServerID,
        };

        if (aloesDevice.authMode === 'ABP') {
          deviceProfile.name = `${aloesDevice.messageProtocol}_ABP`;
          deviceProfile.supportsJoin = false;
          deviceProfile.rxDataRate2 = 5;
          deviceProfile.rxDelay1 = 1;
          deviceProfile.rxFreq2 = 868100000;
          deviceProfile.factoryPresetFreqs = [
            868000000,
            868100000,
            868300000,
            868500000,
            868700000,
          ];
        } else if (aloesDevice.authMode === 'OTAA') {
          deviceProfile.name = `${aloesDevice.messageProtocol}_OTAA`;
          deviceProfile.supportsJoin = true;
        }

        const result = await LoraDeviceProfile.create({ deviceProfile });
        if (!result || !result.deviceProfile) {
          throw new Error('Error while creating device profile');
        }
        deviceProfile = await LoraDeviceProfile.findById(result.deviceProfile);
        return deviceProfile;
      } catch (error) {
        console.log(`${collectionName}-compose elem err`, error);
        return error;
      }
    };

    LoraDeviceProfile.compose = async (loraApp, aloesDevice) => {
      try {
        const deviceProfiles = await LoraDeviceProfile.find({
          limit: 20,
          applicationID: loraApp.id,
          organizationID: loraApp.organizationID,
        });
        // console.log(`${collectionName}-compose req`, deviceProfiles);
        let deviceProfile;
        if (!deviceProfiles || deviceProfiles.totalCount === '0') {
          deviceProfile = await compose(
            loraApp,
            aloesDevice,
          );
        } else {
          deviceProfile = deviceProfiles.result.find(profile => {
            if (
              aloesDevice.authMode === 'OTAA' &&
              profile.name === `${aloesDevice.messageProtocol}_OTAA`
            ) {
              return profile;
            }
            if (
              aloesDevice.authMode === 'ABP' &&
              profile.name === `${aloesDevice.messageProtocol}_ABP`
            ) {
              return profile;
            }
            return false;
          });

          if (!deviceProfile || deviceProfile === null) {
            deviceProfile = await compose(
              loraApp,
              aloesDevice,
            );
          } else {
            deviceProfile = await LoraDeviceProfile.findById(deviceProfile.id);
            let hasChanged = true;
            // todo get those values from env ?
            deviceProfile.macVersion = '1.0.3';
            deviceProfile.rfRegion = 'EU868';
            deviceProfile.regParamsRevision = 'A';

            if (aloesDevice.authMode === 'ABP' && deviceProfile.supportsJoin) {
              deviceProfile.supportsJoin = false;
              hasChanged = true;
            } else if (aloesDevice.authMode === 'OTAA' && !deviceProfile.supportsJoin) {
              deviceProfile.supportsJoin = true;
              hasChanged = true;
            }

            if (hasChanged) {
              await LoraDeviceProfile.updateById(deviceProfile.id, { deviceProfile });
            }
          }
        }
        console.log(`${collectionName}-compose res`, deviceProfile);
        return deviceProfile;
      } catch (error) {
        console.log(`${collectionName}-compose err`, error);
        return error;
      }
    };
  });
};
