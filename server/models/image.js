var aws = require('aws-sdk');

module.exports = function (Image) {
  var s3;
 
  function getCredentials(){
    return new Promise(function (resolve,reject){

      Image.app.models.Service.get_service('aws').then(function (service) {  
      aws.config.update({accessKeyId: service.public_key , secretAccessKey: service.secret_key });
      aws.config.update({region: service.params.region , signatureVersion: 'v4' });
      
      s3 = new aws.S3();
      
      resolve(service)
      });
    })
  }

  Image.signed_put = function(file_name, file_type, callback) {
    getCredentials().then(function (service){
      var s3_params = {
        Bucket: service.params.bucket,
        Key: file_name,
        Expires: 60,
        ContentType: file_type,
        ACL: 'public-read'
      };
      s3.getSignedUrl('putObject', s3_params, function (err, signed_url) {
        if (err) {
          callback(err);
          return;
        }
        callback(null, signed_url);
      });
    });
  };

  Image.remoteMethod('signed_put', {
    http: { verb: 'get' },
    accepts: [
      {arg: 'file_name', type: 'string'},
      {arg: 'file_type', type: 'string'}
    ],
    returns: {arg: 'signed_url', type: 'string'}
  });


  Image.signed_list = function (folder, callback) {
    getCredentials().then(function (service){
      var s3_params = {
        Bucket: service.params.bucket,
        Key: file_name,
        EncodingType: 'url',
        // Delimiter: 'STRING_VALUE',
        // Marker: 'STRING_VALUE',
        Prefix: folder,
        MaxKeys: 1000
      };
      s3.getSignedUrl('listObjects', s3_params, function (err, signed_url) {
        if (err) {
          callback(err);
          return;
        }
        callback(null, signed_url);
      });
    });
  };

  Image.remoteMethod('signed_list', {
    http: { verb: 'get' },
    accepts: { arg: 'folder', type: 'string' },
    returns: { arg: 'signed_url', type: 'string' }
  });

  Image.signed_delete = function(file_name, callback) {
   getCredentials().then(function (service){
      var s3_params = {
        Bucket: service.params.bucket,
        Key: file_name,
        Key: file_name
      };
      s3.getSignedUrl('deleteObject', s3_params, function (err, signed_url) {
        if (err) {
          callback(err);
          return;
        }
        callback(null, signed_url);
      });
    });
  };

  Image.remoteMethod('signed_delete', {
    http: { verb: 'get' },
    accepts: {arg: 'file_name', type: 'string'},
    returns: {arg: 'signed_url', type: 'string'}
  });

};