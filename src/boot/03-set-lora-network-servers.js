/* Copyright 2019 Edouard Maleix, read LICENSE */

export default function initLoraServerConfig(app) {
  app.once('connected:lora-server', async (LoraRest, LoraServer) => {
    try {
      //  console.log('connectToLoraServer:res', LoraRest.settings);
      const loraAppModels = [
        'LoraApplication',
        'LoraDevice',
        'LoraDeviceProfile',
        'LoraGateway',
        'LoraOrganization',
        'LoraUser',
        'NetworkServer',
        'ServiceProfile',
      ];
      const configuredModels = await loraAppModels.map(async modelName => {
        try {
          // eslint-disable-next-line security/detect-object-injection
          const Model = app.models[modelName];
          await app.loopback.configureModel(Model, {
            dataSource: LoraRest,
          });
          Model.emit('ready:lora-rest', LoraRest, LoraServer);
          return modelName;
        } catch (error) {
          console.log('loraAppModels:err', error);
          return null;
        }
      });
      await Promise.all(configuredModels);

      //  const LoraRestConnector = LoraRest.connector;
      // LoraRestConnector.observe('before execute', (ctx, next) => {
      //   console.log(' lora API:before execute', ctx.req);
      //   return next();
      // });

      //  check organisations
      const organization = await app.models.LoraOrganization.compose();
      process.env.LORA_ORGANIZATION_ID = organization.id;

      //  check if user is in this organisation
      const users = await app.models.LoraUser.find({
        limit: 1,
        search: process.env.LORA_HTTP_USER,
      });
      let user = {};
      if (!users || Number(users.totalCount) === 0) {
        throw new Error('But i exist !');
      } else {
        user = users.result[0];
      }
      console.log('LoraUser:res', user);
      await app.models.LoraOrganization.findOrCreateUser(organization.id, user);

      // check network-servers
      const networkServer = await app.models.NetworkServer.compose();
      process.env.LORA_NETWORK_SERVER_ID = networkServer.id;

      // check service-profiles
      //  const serviceProfileID = process.env.LORA_SERVICE_PROFILE_ID;
      const serviceProfile = await app.models.ServiceProfile.compose(
        organization.id,
        networkServer.id,
      );
      process.env.LORA_SERVICE_PROFILE_ID = serviceProfile.id;

      // check gateways
      const loraGatewayId = process.env.LORA_GATEWAY_ID;
      const gateway = await app.models.LoraGateway.compose(
        organization.id,
        networkServer.id,
        loraGatewayId,
      );
      if (gateway && gateway.id) {
        process.env.LORA_GATEWAY_ID = gateway.id;
      }

      // check applications
      const messageProtocols = process.env.MESSAGE_PROTOCOLS.split(',');
      await app.models.LoraApplication.compose(messageProtocols);

      const loraConf = {
        organizationId: organization.id,
        networkServerId: networkServer.id,
        serviceProfileId: serviceProfile.id,
      };
      app.emit('ready:lora-server', loraConf);
    } catch (error) {
      app.emit('error:lora-server', error);
      // return null;
    }
  });

  // return app;
}
