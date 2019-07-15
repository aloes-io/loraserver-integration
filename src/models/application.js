//  import aloesProtocol from '../initial-data/aloes-protocol';

/**
 * @module Application
 * @property {String} id  Database generated ID.
 * @property {String} name Unique name defined by user required.
 * @property {String} description Define Application purpose.
 * @property {Array} collaborators A list of users ids who have permissions to use this application
 * @property {Array} clients A list of client ids authentified as this application
 */

module.exports = function(Application) {
  const collectionName = 'Application';

  Application.disableRemoteMethodByName('exists');
  Application.disableRemoteMethodByName('upsert');
  Application.disableRemoteMethodByName('replaceOrCreate');
  //  Application.disableRemoteMethodByName('prototype.updateAttributes');
  //  Application.disableRemoteMethodByName('prototype.patchAttributes');
  Application.disableRemoteMethodByName('createChangeStream');

  Application.beforeRemote('**', async ctx => {
    try {
      //  if (!ctx.req.accessToken) throw new Error('missing token');
      //  console.log('Mesurement context', ctx.req.accessToken, ctx.method.name);
      return ctx;
    } catch (error) {
      return error;
    }
  });

  Application.on('publish', async message => {
    try {
      const application = JSON.parse(message.payload);
      const topic = message.topic;
      const params = message.params;
      if (!topic || !application || !params || !params.method) throw new Error('Invalid message');
      // console.log(`${collectionName} - received : `, params, application);

      switch (params.method.toUpperCase()) {
        case 'HEAD':
          break;
        case 'GET':
          break;
        case 'POST':
          // if method === post create new Application profile and nex Application if the dont exist
          await Application.replaceOrCreate(application);
          break;
        case 'PUT':
          await Application.replaceOrCreate(application);
          break;
        case 'DELETE':
          await Application.deleteById(application.id);
          break;
        default:
          throw new Error('Wrong method');
      }
      return message;
    } catch (error) {
      return error;
    }
  });

  Application.publish = async (application, method) => {
    try {
      console.log(`${collectionName} - publish : `, method);
      if (Application.app.aloesClient) {
        //  const params = {};
        //  const aloesTopic = await mqttPattern.fill(aloesProtocol.instancePattern, params);
        //  await Application.app.aloesClient.publish(aloesTopic, payload, { qos: 0 });
        //  return { topic, payload };
      }
      return null;
    } catch (error) {
      return error;
    }
  };
};
