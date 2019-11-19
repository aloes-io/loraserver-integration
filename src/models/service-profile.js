/* Copyright 2019 Edouard Maleix, read LICENSE */

/**
 * @module ServiceProfile
 * @property {String} id  Generated ID.
 * @property {Number} value required.
 */
module.exports = function(ServiceProfile) {
  const collectionName = 'ServiceProfile';

  ServiceProfile.once('ready:lora-rest', LoraRest => {
    const save = async instance =>
      new Promise((resolve, reject) => {
        LoraRest.connector.save(collectionName, instance, (err, res) =>
          err ? reject(err) : resolve(res.serviceProfile),
        );
      });

    ServiceProfile.updateById = async (serviceProfileId, serviceProfile) => {
      try {
        if (!serviceProfileId || !serviceProfile.serviceProfile) {
          return null;
        }
        if (!serviceProfile.id) {
          serviceProfile.serviceProfile.id = serviceProfileId;
          serviceProfile.id = serviceProfileId;
        }
        const id = await save(serviceProfile);
        console.log(`${collectionName}-updateById:res`, id);
        serviceProfile = await ServiceProfile.findById(serviceProfileId);
        return serviceProfile;
      } catch (error) {
        console.log(`${collectionName}-updateById:err`, error);
        throw error;
      }
    };

    ServiceProfile.replaceOrCreate = async serviceProfile => {
      try {
        if (!serviceProfile.serviceProfile) {
          return null;
        }
        if (!serviceProfile.serviceProfile.id) {
          const result = await ServiceProfile.create(serviceProfile);
          serviceProfile = result.serviceProfile;
          serviceProfile = await ServiceProfile.findById(result.serviceProfile);
        } else {
          serviceProfile = await ServiceProfile.updateById(
            serviceProfile.serviceProfile.id,
            serviceProfile,
          );
        }
        console.log(`${collectionName}-replaceOrCreate res`, serviceProfile);
        return serviceProfile;
      } catch (error) {
        console.log(`${collectionName}-replaceOrCreate err`, error);
        throw error;
      }
    };

    ServiceProfile.compose = async (organizationID, networkServerID) => {
      try {
        const serviceProfiles = await ServiceProfile.find({
          limit: 2,
          organizationID,
        });
        let serviceProfile = {};
        if (!serviceProfiles || serviceProfiles.totalCount === '0') {
          serviceProfile = {
            name: `${process.env.NODE_NAME}_SP`,
            organizationID,
            networkServerID,
            addGWMetaData: true,
            drMax: 12,
            drMin: 1,
            nwkGeoLoc: false,
            channelMask: null,
            devStatusReqFreq: 0,
            dlBucketSize: 0,
            dlRate: 0,
            dlRatePolicy: 'DROP',
            hrAllowed: true,
            minGWDiversity: 0,
            prAllowed: false,
            raAllowed: false,
            reportDevStatusBattery: false,
            reportDevStatusMargin: false,
            targetPER: 0,
            ulBucketSize: 0,
            ulRate: 0,
            ulRatePolicy: 'DROP',
          };
          const result = await ServiceProfile.create({ serviceProfile });
          serviceProfile = await ServiceProfile.findById(result.serviceProfile);
        } else {
          serviceProfile = serviceProfiles.result[0];
        }

        console.log(`${collectionName}-compose res`, serviceProfile);
        return serviceProfile;
      } catch (error) {
        console.log(`${collectionName}-compose err`, error);
        throw error;
      }
    };
  });
};
