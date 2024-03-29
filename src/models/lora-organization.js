/* Copyright 2019 Edouard Maleix, read LICENSE */

/**
 * @module LoraOrganization
 * @property {String} id  Generated ID.
 * @property {Number} value required.
 */
module.exports = function(LoraOrganization) {
  const collectionName = 'LoraOrganization';

  LoraOrganization.once('ready:lora-rest', (LoraRest, LoraServer) => {
    const save = async instance =>
      new Promise((resolve, reject) => {
        LoraRest.connector.save(collectionName, instance, (err, res) =>
          err ? reject(err) : resolve(res.organization),
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
        throw error;
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
        throw error;
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
        throw error;
      }
    };

    LoraOrganization.findOrCreateUser = async (organizationId, user) => {
      try {
        const token = process.env.LORA_HTTP_TOKEN;
        const loraOrgUsers = await LoraServer.getOrganizationUsers(token, organizationId, 2);
        let organizationUser;
        if (!loraOrgUsers || Number(loraOrgUsers.totalCount) === 0) {
          organizationUser = {
            username: user.username,
            isAdmin: user.isAdmin,
            userID: user.id,
            organizationID: organizationId,
          };
          await LoraServer.createOrganizationUser(token, organizationId, {
            organizationUser,
          });
          organizationUser = await LoraServer.getOrganizationUser(token, organizationId, user.id);
        } else {
          organizationUser = loraOrgUsers.result[0];
        }
        console.log(`${collectionName}-findOrCreateUser res`, organizationUser);
        return organizationUser;
      } catch (error) {
        console.log(`${collectionName}-findOrCreateUser err`, error);
        throw error;
      }
    };
  });
};
