var async = require('async');
var aws = require('aws-sdk');

module.exports = function (Document) {
  
  var s3;
  
  function getCredentials(){
    return new Promise(function (resolve,reject){
      Document.app.models.Service.get_service('aws').then(function (service) {  
      aws.config.update({accessKeyId: service.public_key , secretAccessKey: service.private_key });
      aws.config.update({region: service.params.region , signatureVersion: 'v4' });
      
      s3 = new aws.S3();
      
      resolve(service)
      });
    })
  }

  var get_document = function (data) {
    return function (next) {
      Document.findById(data.document_id, function (err, model) {
        data.document = model;
        data.path = "courses/" + data.document.course_id + "/documents/" + data.document.title;
        console.log(data.path);
        setImmediate(next, err);
      });
    };
  }

  var delete_document = function(data) {
    return function (next) {
      getCredentials().then(function (service){
        var params = {
          Bucket: service.params.bucket, /* required */
          Key: data.path
        };
        console.log(params)
        s3.deleteObject(params, function(err, data) {
          setImmediate(next,err)
        });
      });
    };

  }

  Document.observe('before delete', function(ctx, callback) {
    data = {};
    data.document_id = ctx.where.id;
    async.waterfall([
        get_document(data),
        delete_document(data)
      ],
      function (err) {
      if (err) {
        callback(err);
        return;
      }
      callback(null);
    });
  });
};