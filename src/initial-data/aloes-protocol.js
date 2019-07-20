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
  collectionPatternOut: '+applicationEui/+collection/+method',
  instancePatternOut: '+applicationEui/+collection/+method/+modelId',
  collectionPatternIn: '+applicationId/+collection/+method',
  instancePatternIn: '+applicationId/+collection/+method/+modelId',
  validators: {
    modelId: 'string',
    collections: ['Application', 'Device', 'Sensor', 'Measurement', 'IoTAgent'],
    methods: ['AUTH', 'HEAD', 'POST', 'GET', 'PUT', 'DELETE', 'STREAM'],
  },
};

module.exports = aloesProtocol;
