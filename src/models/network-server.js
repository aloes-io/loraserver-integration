/* eslint-disable no-param-reassign */

/**
 * @module NetworkServer
 * @property {String} id  Generated ID.
 * @property {Number} value required.
 */
module.exports = function(NetworkServer) {
  const collectionName = 'NetworkServer';

  NetworkServer.on('dataSourceAttached', () => {
    const save = async instance =>
      new Promise((resolve, reject) => {
        NetworkServer.app.datasources.loraRest.connector.save(
          collectionName,
          instance,
          (err, res) => (err ? reject(err) : resolve(res.networkServer)),
        );
      });

    NetworkServer.updateById = async (networkServerId, networkServer) => {
      try {
        if (!networkServerId || !networkServer.networkServer) {
          return null;
        }
        if (!networkServer.id) {
          networkServer.networkServer.id = networkServerId;
          networkServer.id = networkServerId;
        }
        const id = await save(networkServer);
        console.log(`${collectionName}-updateById:res`, id);
        networkServer = await NetworkServer.findById(networkServerId);
        return networkServer;
      } catch (error) {
        console.log(`${collectionName}-updateById:err`, error);
        return error;
      }
    };

    NetworkServer.replaceOrCreate = async networkServer => {
      try {
        if (!networkServer.networkServer) {
          return null;
        }
        if (!networkServer.networkServer.id) {
          const result = await NetworkServer.create(networkServer);
          networkServer = result.networkServer;
          networkServer = await NetworkServer.findById(result.networkServer);
        } else {
          networkServer = await NetworkServer.updateById(
            networkServer.networkServer.id,
            networkServer,
          );
        }
        console.log(`${collectionName}-replaceOrCreate res`, networkServer);
        return networkServer;
      } catch (error) {
        console.log(`${collectionName}-replaceOrCreate err`, error);
        return error;
      }
    };

    NetworkServer.compose = async () => {
      try {
        const networkServers = await NetworkServer.find({
          limit: 2,
          //  organizationID: organization.id,
        });
        let networkServer = {};
        if (!networkServers || networkServers.totalCount === '0') {
          networkServer = {
            gatewayDiscoveryDR: 5,
            gatewayDiscoveryEnabled: true,
            gatewayDiscoveryInterval: 2,
            gatewayDiscoveryTXFrequency: 868100000,
            name: `${process.env.NODE_NAME}_NS`,
            server: process.env.LORA_NETWORK_SERVER_URL || 'localhost:8000',
          };
          const result = await NetworkServer.create({ networkServer });
          networkServer = await NetworkServer.findById(result.networkServer);
        } else {
          networkServer = networkServers.result[0];
        }

        console.log(`${collectionName}-compose res`, networkServer);
        return networkServer;
      } catch (error) {
        console.log(`${collectionName}-compose err`, error);
        return error;
      }
    };
  });
};
