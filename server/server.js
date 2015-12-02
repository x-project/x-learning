var loopback = require('loopback');
var boot = require('loopback-boot');
var path = require('path');
var env = require('node-env-file');
var auth = require('./auth/auth');

var ExpressPeerServer = require('peer').ExpressPeerServer;

var app = module.exports = loopback();
var server = require('http').createServer(app);

env(__dirname + '/.env');

app.start = function() {
  // start the web server
  return app.listen(function() {
    app.emit('started');
    var baseUrl = app.get('url').replace(/\/$/, '');
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

  //sns
  require('./sns/listener')(app);


  // peerjs server
  var options = {
      debug: true
  }
  app.use('/peerjs', ExpressPeerServer(server, options));

  server.listen(9000);

  // start the server if `$ node server.js`
  if (require.main === module)
    app.start();
});
