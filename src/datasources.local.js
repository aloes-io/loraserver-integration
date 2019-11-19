module.exports = {
  db: {
    name: 'db',
    connector: 'memory',
    maxDepthOfQuery: 12,
    maxDepthOfData: 32,
    file: './log/session.json',
  },
  aloesServer: {
    name: 'aloesServer',
    connector: 'rest',
    baseURL: process.env.ALOES_HTTP_BASE_URL || 'http://localhost:8000/api',
    debug: true,
    options: {
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        apikey: process.env.APPLICATION_KEY,
        appid: process.env.APPLICATION_ID,
      },
      strictSSL: false,
    },
    operations: [
      {
        template: {
          method: 'GET',
          url: `${process.env.ALOES_HTTP_BASE_URL}/Applications/get-state/{appId}`,
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
          },
        },
        functions: {
          getApplicationState: ['appId'],
        },
      },
    ],
  },
  loraRest: {
    name: 'loraRest',
    connector: 'rest',
    baseURL: process.env.LORA_HTTP_BASE_URL || 'http://localhost:8080/api',
    //  uri: '/',
    debug: true,
    options: {
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      strictSSL: false,
    },
  },
  loraServer: {
    name: 'loraServer',
    connector: 'rest',
    baseURL: process.env.LORA_HTTP_BASE_URL || 'http://localhost:8080/api',
    //  uri: '/',
    debug: true,
    options: {
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      strictSSL: false,
    },
    operations: [
      {
        template: {
          method: 'POST',
          url: `${process.env.LORA_HTTP_BASE_URL}/internal/login`,
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
          },
          body: '{body}',
        },
        functions: {
          login: ['body'],
        },
      },
      {
        template: {
          method: 'GET',
          url: `${process.env.LORA_HTTP_BASE_URL}/organizations/{orgId}/users`,
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            'Grpc-Metadata-Authorization': '{token}',
          },
          query: {
            limit: '{limit}',
            offset: '{offset}',
          },
        },
        functions: {
          getOrganizationUsers: ['token', 'orgId', 'limit', 'offset'],
        },
      },
      {
        template: {
          method: 'GET',
          url: `${process.env.LORA_HTTP_BASE_URL}/organizations/{orgId}/users/{userId}`,
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            'Grpc-Metadata-Authorization': '{token}',
          },
        },
        functions: {
          getOrganizationUser: ['token', 'orgId', 'userId'],
        },
      },
      {
        template: {
          method: 'POST',
          url: `${process.env.LORA_HTTP_BASE_URL}/organizations/{orgId}/users`,
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            'Grpc-Metadata-Authorization': '{token}',
          },
          body: '{user}',
        },
        functions: {
          createOrganizationUser: ['token', 'orgId', 'user'],
        },
      },
      {
        template: {
          method: 'GET',
          url: `${process.env.LORA_HTTP_BASE_URL}/devices/{deviceDevEui}/keys`,
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            'Grpc-Metadata-Authorization': '{token}',
          },
        },
        functions: {
          getDeviceKeys: ['token', 'deviceDevEui'],
        },
      },
      {
        template: {
          method: 'POST',
          url: `${process.env.LORA_HTTP_BASE_URL}/devices/{deviceDevEui}/keys`,
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            'Grpc-Metadata-Authorization': '{token}',
          },
          body: '{keys}',
        },
        functions: {
          createDeviceKeys: ['token', 'deviceDevEui', 'keys'],
        },
      },
      {
        template: {
          method: 'PUT',
          url: `${process.env.LORA_HTTP_BASE_URL}/devices/{deviceDevEui}/keys`,
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            'Grpc-Metadata-Authorization': '{token}',
          },
          body: '{keys}',
        },
        functions: {
          updateDeviceKeys: ['token', 'deviceDevEui', 'keys'],
        },
      },
      {
        template: {
          method: 'DELETE',
          url: `${process.env.LORA_HTTP_BASE_URL}/devices/{deviceDevEui}/keys`,
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            'Grpc-Metadata-Authorization': '{token}',
          },
        },
        functions: {
          updateDeviceKeys: ['token', 'deviceDevEui'],
        },
      },
      {
        template: {
          method: 'GET',
          url: `${process.env.LORA_HTTP_BASE_URL}/devices/{deviceDevEui}/activation`,
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            'Grpc-Metadata-Authorization': '{token}',
          },
        },
        functions: {
          getDeviceActivation: ['token', 'deviceDevEui'],
        },
      },
      {
        template: {
          method: 'POST',
          url: `${process.env.LORA_HTTP_BASE_URL}/devices/{deviceDevEui}/activate`,
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            'Grpc-Metadata-Authorization': '{token}',
          },
          body: '{activation}',
        },
        functions: {
          activateDevice: ['token', 'deviceDevEui', 'activation'],
        },
      },
    ],
  },
};
