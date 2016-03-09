var loopback = require('loopback');
var boot = require('loopback-boot');
var path = require('path');
var env = require('node-env-file');
var auth = require('./auth/auth');
var fs = require('fs');
var http = require('http');
var https = require('https');
var peer = require('peer');

env(__dirname + '/.env');

var peerServer = peer.ExpressPeerServer;

var app = module.exports = loopback();

var key = fs.readFileSync(path.join(__dirname, '/ssl/server.key'));
var cert = fs.readFileSync(path.join(__dirname, '/ssl/server.crt'));
var ssl_options = { key: key, cert: cert};
var server;

app.start = function() {
  // var server = http.createServer(app);

  // start the web server
  server.listen(3000, function() {
    var baseUrl = app.get('protocol') + '://' + app.get('host') + ':' + app.get('port');
    app.emit('started', baseUrl);
    console.log('Web server listening at: %s', baseUrl);
    if (app.get('loopback-component-explorer')) {
      var explorerPath = app.get('loopback-component-explorer').mountPath;
      console.log('Browse your REST API at %s%s', baseUrl, explorerPath);
    }
  });
};



// Bootstrap the application, configure models, datasources and middleware.
// Sub-apps like REST API are mounted via boot scripts.
boot(app, __dirname, function(err) {
  if (err) throw err;

  auth(app);

  app.use(loopback.static(path.resolve(__dirname, '../public')));

  // sns
  // require('./sns/listener')(app);
  server = https.createServer(ssl_options, app);

  // peerjs server
  var options = { debug: true };
  app.use('/peerjs', peerServer(server, options));

  server.listen(9000);

  // start the server if `$ node server.js`
  if (require.main === module) {
    app.start();
  }
});
