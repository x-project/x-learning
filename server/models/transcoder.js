var aws = require('aws-sdk');

module.exports = function (Transcoder) {
  var AWS_ACCESS_KEY = process.env.AWS_ACCESS_KEY;
  var AWS_SECRET_KEY = process.env.AWS_SECRET_KEY;
  var S3_BUCKET = process.env.S3_BUCKET;
  var S3_REGION = process.env.S3_REGION;
  var PIPELINE_ID = process.env.PIPELINE_ID;
  var PRESET_ID = process.env.PRESET_ID;

  aws.config.update({accessKeyId: AWS_ACCESS_KEY , secretAccessKey: AWS_SECRET_KEY });
  aws.config.update({region: S3_REGION , signatureVersion: 'v4' });
  
  var elastictranscoder = new aws.ElasticTranscoder();

  Transcoder.createJob = function (file_name,callback){
    
    var input_params = {
      Input: { 
        Key: file_name, 
        FrameRate: 'auto', 
        Resolution: 'auto', 
        AspectRatio: 'auto', 
        Interlaced: 'auto', 
        Container: 'auto' 
      }, 
      PipelineId: PIPELINE_ID, // specifies output/input buckets in S3 
      OutputKeyPrefix: 'courses/courses_id/videos',
      Output: { 
        Key: file_name+'.m3u8', 
        PresetId: PRESET_ID, // specifies the output video format
        SegmentDuration: '5',
        ThumbnailPattern:'image/' + file_name + '-{count}'//modifica preset per determinare il numero di immagini
      },

    };
    
    elastictranscoder.createJob(input_params, function(err, data) {
      if (err) {
        console.log(err, err.stack); // an error occurred
        callback(err);
        return;
      }else{
        callback(null, data);
      }
    });
  };
  
  Transcoder.remoteMethod('createJob', {
    http: { verb: 'put' },
    accepts: [
      {arg: 'file_name', type: 'string'}
    ],
    returns: {arg: 'dataId', type: 'string'}
  });
};
