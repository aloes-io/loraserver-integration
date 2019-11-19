/* Copyright 2019 Edouard Maleix, read LICENSE */

/**
 * LoraServer MQTT API
 * @external LoraServerAPI
 * @see {@link https://www.loraserver.io/lora-app-server/integrate/sending-receiving/mqtt/}
 */

/**
 * References used to validate payloads
 * @namespace
 * @property {string}  pattern The pattern used by Lora App server.
 * @property {object}  validators Check inputs / build outputs
 * @property {array}   validators.mTypes Used by LoraWAN Stack.
 * @property {array}   validators.types Used by LoraWAN Stack.
 * @property {array}   validators.collections
 * @property {array}   validators.methods
 */

const loraAppProtocol = {
  devicePattern: '+collection/+instanceId/device/+devEui/+method',
  pattern: '+collection/+instanceId/+method',
  validators: {
    instanceId: 'string',
    mTypes: [
      'Join Request',
      'Join Accept',
      'Confirmed Data Up',
      'Unconfirmed Data Up',
      'Confirmed Data Down',
      'Unconfirmed Data Down',
      'Proprietary',
      'Presentation',
    ],
    types: ['PUSH_DATA', 'PULL_DATA', 'PULL_RESP', 'PUSH_ACK', 'PULL_ACK', 'TX_ACK'],
    collections: ['application', 'gateway'],
    methods: ['stats', 'status', 'join', 'ack', 'error', 'rx', 'tx'],
    devEuiLength: 16,
  },
};

module.exports = loraAppProtocol;
