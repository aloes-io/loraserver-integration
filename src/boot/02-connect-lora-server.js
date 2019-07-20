import rest from 'loopback-connector-rest';

export default async function connectToLoraServer(app) {
  try {
    const loraServer = await app.datasources.loraServer;

    const credentials = {
      username: process.env.LORA_HTTP_USER,
      password: process.env.LORA_HTTP_PASS,
    };

    const loraRestConfig = {
      name: 'loraRest',
      connector: rest,
      baseURL: `${process.env.LORA_HTTP_BASE_URL}` || 'http://localhost:8080/api',
      //  uri: '/',
      debug: true,
      options: {
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'Grpc-Metadata-Authorization': process.env.LORA_HTTP_TOKEN,
        },
        strictSSL: false,
      },
    };

    app.on('error:lora-server', async err => {
      // log again and emit refresh:lora-server
      console.log('lora-server:err', err);
      return null;
    });

    app.on('ready:aloes-client', AloesClient => {
      app.models.Application.emit('ready:aloes-client', AloesClient);
      app.models.Device.emit('ready:aloes-client', AloesClient);
      return app.models.Sensor.emit('ready:aloes-client', AloesClient);
    });

    app.on('ready:lora-client', LoraClient => {
      app.models.LoraDevice.emit('ready:lora-client', LoraClient);
      app.models.LoraGateway.emit('ready:lora-client', LoraClient);
      return app.models.LoraApplication.emit('ready:lora-client', LoraClient);
    });

    app.on('error:aloes-client', async err => {
      console.log('aloes-client:err', err);
      return null;
    });

    app.on('error:lora-client', async err => {
      console.log('lora-client:err', err);
      return null;
    });

    app.on('stopped:aloes-client', async status => {
      console.log('aloes-client:stopped', status);
      return null;
    });

    app.on('stopped:lora-client', async status => {
      console.log('lora-client:stopped', status);
      return null;
    });

    app.once('loggedin:lora-server', async (interval, token) => {
      try {
        clearInterval(interval);
        loraServer.settings.options.headers['Grpc-Metadata-Authorization'] = token.jwt;
        process.env.LORA_HTTP_TOKEN = token.jwt;
        loraRestConfig.options.headers['Grpc-Metadata-Authorization'] = token.jwt;
        console.log('connected:lora-server', token.jwt);
        const loraRest = await app.loopback.createDataSource(loraRestConfig);
        app.datasources.loraRest = loraRest;
        // console.log('loraServer', loraServer.settings.options.headers);
        return app.emit('connected:lora-server', loraRest, loraServer);
      } catch (error) {
        return error;
      }
    });

    if (process.env.LORA_HTTP_TOKEN) {
      //  const token = process.env.LORA_HTTP_TOKEN;
      const loraRest = await app.loopback.createDataSource(loraRestConfig);
      app.datasources.loraRest = loraRest;
      app.emit('connected:lora-server', loraRest, loraServer);
    } else {
      let failCounts = 1;
      const tryAgain = setInterval(async () => {
        try {
          console.log('try login');
          const token = await loraServer.login(credentials);
          if (!token || !token.jwt) failCounts += 1;
          else {
            failCounts = 0;
            app.emit('loggedin:lora-server', tryAgain, token);
          }
          return token;
        } catch (error) {
          console.log('connectToLoraServer:err', error);
          failCounts += 1;
          return error;
        }
      }, failCounts * 1000);
    }

    return loraServer;
  } catch (error) {
    app.emit('error:lora-server', error);
    return error;
  }
}
