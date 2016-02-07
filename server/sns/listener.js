var aws = require('aws-sdk');

module.exports = function (sns) {
  
  var AWS_ACCESS_KEY = process.env.AWS_ACCESS_KEY;
  var AWS_SECRET_KEY = process.env.AWS_SECRET_KEY;
  var S3_BUCKET = process.env.S3_BUCKET;
  var S3_REGION = process.env.S3_REGION;
  aws.config.update({accessKeyId: AWS_ACCESS_KEY , secretAccessKey: AWS_SECRET_KEY });
  aws.config.update({region: S3_REGION , signatureVersion: 'v4' });

  var s3 = new aws.S3();
  var sqs = new aws.SQS();
  var queueUrl = "https://sqs.us-west-2.amazonaws.com/090870039614/x-learning-queue ";

  var receiveMessageParams = {
    QueueUrl: queueUrl
  };

  sqs.receiveMessage(receiveMessageParams, receiveMessageCallback);

  function receiveMessageCallback(err, data) {
    if (data.Messages && data.Messages.length > 0) {
      console.log(data.Messages[0])
      var message = JSON.parse(data.Messages[0].Body);
      var key = JSON.parse(message.Message).input.key;
      
      // Delete the message when we've successfully processed it
      var deleteMessageParams = {
        QueueUrl: queueUrl,
        ReceiptHandle: data.Messages[0].ReceiptHandle
      };

      var s3_params = {
        Bucket: S3_BUCKET,
        Delete: { 
          Objects: [ 
            {
              Key: key
            }
          ]
        }
      };
      s3.deleteObjects(s3_params,deleteObjCallback)
      sqs.deleteMessage(deleteMessageParams, deleteMessageCallback);
    }

    setTimeout(run_handler, 1000 * 60 * 5);
  }

  function deleteMessageCallback(err, data) {
    console.log("deleted message SNS");
    console.log(data);
  }

  function run_handler () {
      sqs.receiveMessage(receiveMessageParams, receiveMessageCallback);
  };

  function deleteObjCallback(err,data){
    if (err) {
      console.log(err, err.stack); // an error occurred
      return;
    }else{
      console.log("deleted message S3");
      console.log(data)
    }
  }

}