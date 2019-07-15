export default async function initLoraServerConfig(app) {
  try {
    app.once('connected:lora-server', async loraRest => {
      try {
        //  console.log('connectToLoraServer:res', loraRest.settings);
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
        const configuredModels = await loraAppModels.map(async modelName =>
          app.loopback.configureModel(app.models[modelName], {
            dataSource: loraRest,
          }),
        );
        await Promise.all(configuredModels);

        //  const loraRestConnector = loraRest.connector;
        // loraRestConnector.observe('before execute', (ctx, next) => {
        //   console.log(' lora API:before execute', ctx.req);
        //   return next();
        // });

        // loraRestConnector.observe('after execute', function(ctx, next) {
        //   console.log(' lora API:after execute', ctx.res.body);
        //   // if (ctx.req.method === 'POST') {
        //   //   ctx.res.body.location = ctx.res.headers.location;
        //   //   return ctx.end(null, ctx, ctx.res.body);
        //   // } else {
        //   //   return next();
        //   // }
        //   next();
        // });

        //  check organisations
        const organization = await app.models.LoraOrganization.compose();
        process.env.LORA_ORGANIZATION_ID = organization.id;

        //
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

        //
        // check network-servers
        const networkServer = await app.models.NetworkServer.compose();
        process.env.LORA_NETWORK_SERVER_ID = networkServer.id;

        // // check service-profiles
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
        return loraConf;
      } catch (error) {
        return error;
      }
    });

    return app;
  } catch (error) {
    app.emit('error:lora-server', error);
    return error;
  }
}
