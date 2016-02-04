var aws = require('aws-sdk');

module.exports = function (Video) {
  
  var s3;
 
  function getCredentials(){
    return new Promise(function (resolve,reject){
      Video.app.models.Service.get_service('aws').then(function (service) {  
      aws.config.update({accessKeyId: service.public_key , secretAccessKey: service.secret_key });
      aws.config.update({region: service.params.region , signatureVersion: 'v4' });
      
      s3 = new aws.S3();
      
      resolve(service)
      });
    })
  }


  Video.create_multiPart_upload = function (file_name,file_type,callback){
    getCredentials().then(function (service){
      var s3_params = {
        Bucket: service.params.bucket,
        Key: file_name,
        Expires: 6000,
        ContentType: file_type,
        ACL: 'public-read'      
      };
      s3.createMultipartUpload(s3_params, function(err, data) {
        if (err) {
          console.log(err, err.stack); // an error occurred
          callback(err);
          return;
        }else{
          callback(null, data);
        }
      });
    })
  };
  
  Video.remoteMethod('create_multiPart_upload', {
    http: { verb: 'get' },
    accepts: [
      {arg: 'file_name', type: 'string'},
      {arg: 'file_type', type: 'string'}
    ],
    returns: {arg: 'dataId', type: 'string'}
  });


  Video.signed_upload_part = function(Key,PartNumber,UploadId,callback) {
    getCredentials().then(function (service){
      var s3_params = {
        Bucket: service.params.bucket,
        Key: Key,
        PartNumber: PartNumber, /* required */
        UploadId: UploadId /* required */
      };
      s3.getSignedUrl('uploadPart', s3_params, function (err, signed_url) {
        if (err) {
          console.log(err);
          callback(err);
          return;
        }
        callback(null, signed_url);
      });
    });
  };

  Video.remoteMethod('signed_upload_part', {
    http: { verb: 'get' },
    accepts: [
      {arg: 'Key', type: 'string'},
      {arg: 'PartNumber', type: 'number'},
      {arg: 'UploadId', type: 'string'}
    ],
    returns: {arg: 'signed_url', type: 'string'}
  });

  Video.complete_upload_part = function(Key, UploadId,Parts,callback) {
    getCredentials().then(function (service){
      var s3_params = {
        Bucket: service.params.bucket,
        Key: Key,
        UploadId: UploadId,
        MultipartUpload: {
          Parts: Parts
        } 
      };
      s3.completeMultipartUpload(s3_params, function (err, signed_url) {
        if (err) {
          console.log('ERRORE COMPLETE: ' + err);
          callback(err);
          return;
        }

        callback(null, signed_url);
      });
    });
  };

  Video.remoteMethod('complete_upload_part', {
    http: { verb: 'put' },
    accepts: [
      {arg: 'Key', type: 'string'},
      {arg: 'UploadId', type: 'string'},
      {arg: 'Parts', type: 'array' }
    ],
    returns: {arg: 'signed_url', type: 'string'}
  });


  Video.delete_video = function(path,callback) {
    getCredentials().then(function (service){
      var params = {
        Bucket: service.params.bucket,
        Prefix: path
      };

      s3.listObjects(params, function(err, data) {
        if (err){
          console.log(err);
          callback(err);
          return;
        } 

        params = {Bucket: service.params.bucket};
        params.Delete = {};
        params.Delete.Objects = [];

        data.Contents.forEach(function(content) {
          params.Delete.Objects.push({Key: content.Key});
        });

        s3.deleteObjects(params, function (err, delete_response) {
          if (err){
            console.log(err);
            callback(err);
            return;
          }

          console.log(delete_response.Deleted.length);
          callback(null, delete_response);
        });
      });
    });
  };

  Video.remoteMethod('delete_video', {
    http: { verb: 'delete' },
    accepts: [
      {arg: 'path', type: 'string'}
    ],
    returns: {arg: 'delete_response', type: 'string'}
  });


  Video.observe('before delete', function(ctx, callback) {
    var data = {};
    var url = ctx.instance.url;
    var path_url = url.split(".net/")[1];
    var path_id = path_url.split("/");
    var path = path_id[0] + "/" + path_id[1] + "/" + path_id[2] + "/";

    Video.delete_video(path,function(err,result){
      console.log("result : " + result);
      callback(null,result);
    });

  });

};
