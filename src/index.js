/*
Copyright 2019 Edouard Maleix

This file is part of Aloes loraserver-integration.

Aloes loraserver-integration is free software: you can redistribute it and/or modify
it under the terms of the Affero GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
 any later version.

Aloes loraserver-integration is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the Affero GNU General Public License
along with Aloes loraserver-integration.  If not, see <https://www.gnu.org/licenses/>.
*/

import dotenv from 'dotenv';
import loopback from 'loopback';
import boot from 'loopback-boot';

const app = loopback();

const result = dotenv.config();
if (result.error) {
  throw result.error;
}

// const config = {
//   ...result.parsed,
//   appRootDir: __dirname,
//   // File Extensions for jest (strongloop/loopback#3204)
//   scriptExtensions: ['.js', '.json', '.node', '.ejs'],
// };

// start the web server
app.start = () =>
  app.listen(() => {
    app.emit('started');
    const baseUrl = app.get('url').replace(/\/$/, '');
    console.log('Web server listening at: %s', baseUrl);
    if (app.get('loopback-component-explorer')) {
      const explorerPath = app.get('loopback-component-explorer').mountPath;
      console.log('Browse your REST API at %s%s', baseUrl, explorerPath);
    }
  });

// Bootstrap the application, configure models, datasources and middleware.
// Sub-apps like REST API are mounted via boot scripts.
boot(app, __dirname, err => {
  if (err) throw err;

  // start the server if `$ node server.js`
  if (require.main === module) app.start();
});

export default app;
