var aws = require('aws-sdk');

module.exports = function (Image) {

  var AWS_ACCESS_KEY = process.env.AWS_ACCESS_KEY;
  var AWS_SECRET_KEY = process.env.AWS_SECRET_KEY;
  var S3_BUCKET = process.env.S3_BUCKET;
  var S3_REGION = process.env.S3_REGION;

  aws.config.update({accessKeyId: AWS_ACCESS_KEY , secretAccessKey: AWS_SECRET_KEY });
  aws.config.update({region: S3_REGION , signatureVersion: 'v4' });
  
  var s3 = new aws.S3();

  Image.create_multiPart_upload = function (file_name,file_type,callback){
    var s3_params = {
      Bucket: S3_BUCKET,
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
        //console.log(data);
        callback(null, data);
      }
    });
  };
  
  Image.remoteMethod('create_multiPart_upload', {
    http: { verb: 'get' },
    accepts: [
      {arg: 'file_name', type: 'string'},
      {arg: 'file_type', type: 'string'}
    ],
    returns: {arg: 'dataId', type: 'string'}
  });


  Image.signed_upload_part = function(Key,PartNumber,UploadId,callback) {
    var s3_params = {
      Bucket: S3_BUCKET,
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
  };

  Image.remoteMethod('signed_upload_part', {
    http: { verb: 'get' },
    accepts: [
      {arg: 'Key', type: 'string'},
      {arg: 'PartNumber', type: 'number'},
      {arg: 'UploadId', type: 'string'}
    ],
    returns: {arg: 'signed_url', type: 'string'}
  });

  Image.complete_upload_part = function(Key, UploadId,Parts,callback) {
    var s3_params = {
      Bucket: S3_BUCKET,
      Key: Key,
      UploadId: UploadId,
      MultipartUpload: {
        Parts: Parts
      } 
    };
    s3.completeMultipartUpload(s3_params, function (err, signed_url) {
      if (err) {
        console.log('ERROREEEEEEEEE: ' + err);
        callback(err);
        return;
      }

      callback(null, signed_url);
    });
  };

  Image.remoteMethod('complete_upload_part', {
    http: { verb: 'put' },
    accepts: [
      {arg: 'Key', type: 'string'},
      {arg: 'UploadId', type: 'string'},
      {arg: 'Parts', type: 'array' }
    ],
    returns: {arg: 'signed_url', type: 'string'}
  });

};
