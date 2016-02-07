var aws = require('aws-sdk');

module.exports = function (Transcoder) {

  var elastictranscoder;

    function getCredentials(){
    return new Promise(function (resolve,reject){
      Transcoder.app.models.Service.get_service('aws').then(function (service) {  
      aws.config.update({accessKeyId: service.public_key , secretAccessKey: service.secret_key });
      aws.config.update({region: service.params.region , signatureVersion: 'v4' });
      
      elastictranscoder = new aws.ElasticTranscoder();
      
      resolve(service)
      });
    })
  }

  Transcoder.createJob = function (file_name,path,callback){
    getCredentials().then(function (service){
      var input_params = {
        Input: { 
          Key: file_name, 
          FrameRate: 'auto', 
          Resolution: 'auto', 
          AspectRatio: 'auto', 
          Interlaced: 'auto', 
          Container: 'auto' 
        }, 
        PipelineId: service.params.pipeline_id, // specifies output/input buckets in S3 
        OutputKeyPrefix: path,
        Output: { 
          Key: file_name, 
          PresetId: service.params.preset_id,// specifies the output video format
          SegmentDuration: '5',
          ThumbnailPattern:'image/' + file_name + '-{count}'//modifica preset per determinare il numero di immagini
        },
      };
        console.log(input_params);
      
      elastictranscoder.createJob(input_params, function(err, data) {
        if (err) {
          console.log(err, err.stack); // an error occurred
          callback(err);
          return;
        }else{
          callback(null, data);
        }
      });
    });
  };
  
  Transcoder.remoteMethod('createJob', {
    http: { verb: 'put' },
    accepts: [
      {arg: 'file_name', type: 'string'},
      {arg: 'path', type: 'string'}
    ],
    returns: {arg: 'dataId', type: 'string'}
  });
};
