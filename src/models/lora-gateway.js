/* eslint-disable no-param-reassign */
//  import loraProtocol from '../initial-data/lora-app-protocol';

/**
 * @module LoraGateway
 * @property {String} id  MAC Address
 * @property {String} name Unique name defined by user required.
 * @property {String} description Define device purpose.
 * @property {array} boards
 * @property {boolean} discoveryEnabled
 * @property {String} deviceProfileID
 * @property {String} gatewayProfileID
 * @property {String} networkServerID
 * @property {String} organizationID
 * @property {Object} location
 */

module.exports = function(LoraGateway) {
  const collectionName = 'LoraGateway';

  LoraGateway.disableRemoteMethodByName('exists');
  LoraGateway.disableRemoteMethodByName('upsert');
  LoraGateway.disableRemoteMethodByName('replaceOrCreate');
  //  LoraGateway.disableRemoteMethodByName('prototype.updateAttributes');
  //  LoraGateway.disableRemoteMethodByName('prototype.patchAttributes');
  LoraGateway.disableRemoteMethodByName('createChangeStream');

  LoraGateway.on('dataSourceAttached', () => {
    LoraGateway.findById = async gatewayMac => {
      try {
        if (!gatewayMac) {
          return null;
        }
        let gateway;
        const gateways = await LoraGateway.find({
          limit: 1,
          search: gatewayMac,
        });
        if (!gateways || gateways.totalCount === 0) {
          gateway = null;
        } else {
          gateway = gateways.result[0];
        }
        return gateway;
      } catch (error) {
        return error;
      }
    };

    /**
     * Helper for gateway deletion
     * @method module:LoraGateway~destroyById
     * @param {string} id - Gateway MAC address ( hex )
     * @returns {promise}  LoraGateway.app.datasources.loraRest.connector.destroy
     */
    const destroyById = async id =>
      new Promise((resolve, reject) => {
        LoraGateway.app.datasources.loraRest.connector.destroy(collectionName, id, (err, res) =>
          err ? reject(err) : resolve(res),
        );
      });

    LoraGateway.deleteById = async gatewayMac => {
      try {
        await destroyById(gatewayMac);
        console.log(`${collectionName}-deleteById res`);
        return gatewayMac;
      } catch (error) {
        console.log(`${collectionName}-deleteById err`, error);
        return error;
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
        LoraGateway.app.datasources.loraRest.connector.save(collectionName, instance, (err, res) =>
          err ? reject(err) : resolve(res.gateway),
        );
      });

    LoraGateway.updateById = async (gatewayMac, gateway) => {
      try {
        if (!gatewayMac || !gateway.gateway) {
          return null;
        }
        if (!gateway.id) {
          gateway.id = gatewayMac;
          gateway.gateway.id = gatewayMac;
        }
        const id = await save(gateway);
        console.log(`${collectionName}-updateById:res`, id);
        gateway = await LoraGateway.findById(gatewayMac);
        return gateway;
      } catch (error) {
        console.log(`${collectionName}-updateById:err`, error);
        return error;
      }
    };

    LoraGateway.compose = async (organizationID, networkServerID, gatewayID) => {
      try {
        let gateway;
        const gateways = await LoraGateway.find({
          limit: 1,
          //  organizationID,
          search: gatewayID,
        });

        if (!gateways || gateways.totalCount === '0') {
          gateway = {
            boards: [],
            name: `${process.env.NODE_NAME}_GW`,
            id: gatewayID,
            description: `${process.env.NODE_NAME} default gateway`,
            gatewayProfileID: '',
            discoveryEnabled: true,
            networkServerID,
            organizationID,
            location: {
              accuracy: 0,
              altitude: 0,
              latitude: 0,
              longitude: 0,
              source: 'UNKNOWN',
            },
          };
          // console.log('new gateway req ', { gateway });

          const result = await LoraGateway.create({ gateway });
          if (!result || !result.gateway) {
            throw new Error('Error while creating gateway');
          }
          gateway = await LoraGateway.findById(result.gateway);
        } else {
          gateway = gateways.result[0];
          if (gateway.id && gateway.organizationID !== organizationID) {
            await LoraGateway.deleteById(gateway.id);
            gateway = {
              boards: [],
              name: `${process.env.NODE_NAME}_GW`,
              id: gatewayID,
              description: `${process.env.NODE_NAME} default gateway`,
              gatewayProfileID: '',
              discoveryEnabled: true,
              networkServerID,
              organizationID,
              location: {
                accuracy: 0,
                altitude: 0,
                latitude: 0,
                longitude: 0,
                source: 'UNKNOWN',
              },
            };
            const result = await LoraGateway.create({ gateway });
            if (!result || !result.gateway) {
              throw new Error('Error while creating gateway');
            }
            gateway = await LoraGateway.findById(result.gateway);
          }
        }
        console.log(`${collectionName}-compose:res`, gateway);
        return gateway;
      } catch (error) {
        console.log(`${collectionName}-compose:err`, error);
        return error;
      }
    };
  });

  LoraGateway.on('publish', async message => {
    try {
      const payload = JSON.parse(message.payload);
      const topic = message.topic;
      const params = message.params;
      if (!topic || !payload || !params || !params.method) throw new Error('Invalid message');
      // if method === post create new device on aloes
      switch (params.method) {
        case 'rx':
          //  console.log(`${collectionName} - received:rx `, payload);
          // gateway = payload.rxInfo
          break;
        case 'tx':
          // gateway = payload.txInfo
          break;
        case 'stats':
          // gateway = payload
          break;
        case 'ack':
          // gateway = payload
          break;
        case 'config':
          // gateway = payload
          break;
        case 'error':
          console.log(`${collectionName} - received:err `, payload);
          break;
        default:
          throw new Error('Wrong method');
      }
      //  const devEui = payload
      // if (payload valid) AloesDevice.emit("message")
      return message;
    } catch (error) {
      return error;
    }
  });
};
