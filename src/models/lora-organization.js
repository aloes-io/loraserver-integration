/* eslint-disable no-param-reassign */

/**
 * @module LoraOrganization
 * @property {String} id  Generated ID.
 * @property {Number} value required.
 */
module.exports = function(LoraOrganization) {
  const collectionName = 'LoraOrganization';

  LoraOrganization.on('dataSourceAttached', () => {
    const save = async instance =>
      new Promise((resolve, reject) => {
        LoraOrganization.app.datasources.loraRest.connector.save(
          (collectionName, instance),
          (err, res) => (err ? reject(err) : resolve(res.organization)),
        );
      });

    LoraOrganization.updateById = async (organizationId, organization) => {
      try {
        if (!organizationId || !organization.organization) {
          return null;
        }
        if (!organization.id) {
          organization.organization.id = organizationId;
          organization.id = organizationId;
        }
        const id = await save(organization);
        console.log(`${collectionName}-updateById:res`, id);
        organization = await LoraOrganization.findById(organizationId);
        return organization;
      } catch (error) {
        console.log(`${collectionName}-updateById:err`, error);
        return error;
      }
    };

    LoraOrganization.replaceOrCreate = async organization => {
      try {
        if (!organization.organization) {
          return null;
        }
        if (!organization.organization.id) {
          const result = await LoraOrganization.create(organization);
          organization = result.organization;
          organization = await LoraOrganization.findById(result.organization);
        } else {
          organization = await LoraOrganization.updateById(
            organization.organization.id,
            organization,
          );
        }
        console.log(`${collectionName}-replaceOrCreate res`, organization);
        return organization;
      } catch (error) {
        console.log(`${collectionName}-replaceOrCreate err`, error);
        return error;
      }
    };

    LoraOrganization.compose = async () => {
      try {
        //  const organizationID = process.env.LORA_ORGANIZATION_ID;
        const organizations = await LoraOrganization.find({
          limit: 2,
          search: process.env.NODE_NAME,
        });

        let organization = {};
        if (!organizations || organizations.totalCount === '0') {
          organization = {
            name: process.env.NODE_NAME,
            canHaveGateways: true,
            displayName: process.env.NODE_NAME,
          };
          const result = await LoraOrganization.create({ organization });
          organization = await LoraOrganization.findById(result.organization);
        } else {
          organization = organizations.result[0];
        }
        console.log(`${collectionName}-compose res`, organization);
        return organization;
      } catch (error) {
        console.log(`${collectionName}-compose err`, error);
        return error;
      }
    };

    LoraOrganization.findOrCreateUser = async (organizationId, user) => {
      try {
        const loraServer = LoraOrganization.app.datasources.loraServer;
        const token = process.env.LORA_HTTP_TOKEN;
        const loraOrgUsers = await loraServer.getOrganizationUsers(token, organizationId, 2);
        let organizationUser;
        if (!loraOrgUsers || Number(loraOrgUsers.totalCount) === 0) {
          organizationUser = {
            username: user.username,
            isAdmin: user.isAdmin,
            userID: user.id,
            organizationID: organizationId,
          };
          await loraServer.createOrganizationUser(token, organizationId, {
            organizationUser,
          });
          organizationUser = await loraServer.getOrganizationUser(token, organizationId, user.id);
        } else {
          organizationUser = loraOrgUsers.result[0];
        }
        console.log(`${collectionName}-findOrCreateUser res`, organizationUser);
        return organizationUser;
      } catch (error) {
        console.log(`${collectionName}-findOrCreateUser err`, error);
        return error;
      }
    };
  });
};
