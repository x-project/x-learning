var fs = require('fs');
var path = require('path');

module.exports = function (server) {

  var START = false;

  var models = {};

  server.models().forEach(function (model) {
    var model_name = model.definition.name;
    models[model_name] = model;
  });

  function fetch_codes (file_name) {
    var defer = Promise.defer();

    fs.readFile(path.join(__dirname + file_name), 'utf8', function (err, text) {
      if (err) {
        defer.reject(err);
        return;
      }

      var list = text.split('\n');
      var codes = list.map(function (code) {
        return { code: code };
      });

      defer.resolve(codes);
    });

    return defer.promise;
  }

  function create_objects (codes) {
    var defer = Promise.defer();

    models['Object'].create(codes, function (err, models) {
      if (err) {
        defer.reject(err);
        return;
      }

      defer.resolve();
      return;
    });
  }

  function success () {
    console.log('yeah!');
  }

  function error (err) {
    console.warn(err);
  }

  function start () {
    fetch_codes('/../data/codes.txt')
      .then(create_objects)
      .then(success)
      .catch(error);
  }

  if (START) {
    start();
  }
};