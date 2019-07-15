/**
 * Aloes MQTT API
 * @external LoraServerAPI
 * @see {@link https://framagit.org/aloes/device-manager/}
 */

/**
 * References used to validate payloads
 * @namespace
 * @property {string}  pattern The pattern used by Aloes MQTT broker.
 * @property {object}  validators Check inputs / build outputs
 * @property {array}   validators.collections
 * @property {array}   validators.methods
 */
const aloesProtocol = {
  collectionPattern: '+applicationId/+collection/+method',
  instancePattern: '+applicationId/+collection/+method/+modelId',
  validators: {
    modelId: 'string',
    collections: ['Application', 'Device', 'Sensor', 'VirtualObject', 'IoTAgent'],
    methods: ['AUTH', 'HEAD', 'POST', 'GET', 'PUT', 'DELETE', 'STREAM'],
  },
};

module.exports = aloesProtocol;
