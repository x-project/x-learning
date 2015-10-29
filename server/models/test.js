var aws = require('aws-sdk');

module.exports = function (Image) {

  var AWS_ACCESS_KEY = process.env.AWS_ACCESS_KEY;
  var AWS_SECRET_KEY = process.env.AWS_SECRET_KEY;
  var S3_BUCKET = process.env.S3_BUCKET;
  var S3_REGION = process.env.S3_REGION;

  aws.config.update({accessKeyId: AWS_ACCESS_KEY , secretAccessKey: AWS_SECRET_KEY });
  aws.config.update({region: S3_REGION , signatureVersion: 'v4' });


  Image.create_multiPart_upload = function (file_name,callback){
    var s3 = new aws.S3();
    var s3_params = {
      Bucket: S3_BUCKET,
      Key: file_name,
      Expires: 6000,
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
    accepts: {arg: 'file_name', type: 'string'},
    returns: {arg: 'dataId', type: 'string'}
  });


  Image.multiPart_upload = function (chunk,file_name,partNum,uploadId,maxUploadTries,callback){
      var s3 = new aws.S3();
      var s3_params = {
        Bucket: S3_BUCKET,
        Key: file_name,
        PartNumber: partNum, /* required */
        UploadId: uploadId,
        multipartMap :{
          Parts: []
        }
      };
     console.log(s3_params);
     
      var tryNum = 1;
      s3.uploadPart(s3_params, function(err, data) {
        if (err){
          console.log('multiErr, upload part error:', err);
          if (tryNum < maxUploadTries) {
            console.log('Retrying upload of part: #', partParams.PartNumber)
            uploadPart(s3, multipart, partParams, tryNum + 1);
          } else {
            console.log('Failed uploading part: #', partParams.PartNumber)
          }
          return;
        }
        multipartMap.Parts[PartNumber - 1] = {
          ETag: data.ETag,
          PartNumber: Number(PartNumber)
        };
        console.log("Completed part", this.request.params.PartNumber);
        console.log('mData', data);
        if (--numPartsLeft > 0) return; // complete only when all parts uploaded

        var doneParams = {
          Bucket: bucket,
          Key: fileKey,
          MultipartUpload: multipartMap,
          UploadId: multipart.UploadId
        };

        console.log("Completing upload...");
      });
    };

  Image.remoteMethod('multiPart_upload', {
      http: { verb: 'put' },
      accepts: [
        {arg: 'chunk', type: 'object'},
        {arg: 'file_name', type: 'string'},
        {arg: 'partNum', type: 'number'},
        {arg: 'uploadId', type: 'string'},
        {arg: 'maxUploadTries', type: 'number'},
        ], 
      returns: {arg: 'data', type: 'string'}
    });


  // Image.signed_complete_multiPart_upload = function (file_name,id_aws,part,callback){
  //     var s3 = new aws.S3();
  //     var s3_params = {
  //       Bucket: S3_BUCKET,
  //       Key: file_name,
  //       UploadId: id_aws, /* required */
  //       MultipartUpload: part
  //     };
  //     console.log(s3_params);
  //     s3.completeMultipartUpload(s3_params, function(err, data) {
  //       if (err){ 
  //         console.log(err, err.stack); // an error occurred
  //         callback(err);
  //         return;
  //       }else{
  //         console.log(data);
  //         callback(null, data);
  //       }
  //     });
  //   };

  // Image.remoteMethod('signed_complete_multiPart_upload', {
  //     http: { verb: 'get' },
  //     accepts: [
  //       {arg: 'file_name', type: 'string'},
  //       {arg: 'id_aws', type: 'string'},
  //       {arg: 'part', type: 'map'}
  //     ],      
  //     returns: {arg: 'data', type: 'string'}
  //   });
};
