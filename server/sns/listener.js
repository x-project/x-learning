var aws = require('aws-sdk');

module.exports = function (app) {
  
  var AWS_ACCESS_KEY = process.env.AWS_ACCESS_KEY;
  var AWS_SECRET_KEY = process.env.AWS_SECRET_KEY;
  var S3_BUCKET = process.env.S3_BUCKET;
  var S3_REGION = process.env.S3_REGION;
  aws.config.update({accessKeyId: AWS_ACCESS_KEY , secretAccessKey: AWS_SECRET_KEY });
  aws.config.update({region: S3_REGION , signatureVersion: 'v4' });

  var sqs = new aws.SQS();
  var queueUrl = "https://sqs.us-west-2.amazonaws.com/090870039614/x-learning-queue ";

  var receiveMessageParams = {
    QueueUrl: queueUrl
  };

  sqs.receiveMessage(receiveMessageParams, receiveMessageCallback);

  function receiveMessageCallback(err, data) {
    console.log("received message");
    console.log(data);

    if (data.Messages && data.Messages.length > 0) {

      console.log("do something with the message here...");
      console.log(data.Messages[0].MessageId)
      console.log(data)
      // Delete the message when we've successfully processed it
      var deleteMessageParams = {
        QueueUrl: queueUrl,
        ReceiptHandle: data.Messages[0].ReceiptHandle
      };

      // sqs.deleteMessage(deleteMessageParams, deleteMessageCallback);
    }
    run_handler();
  }

  function deleteMessageCallback(err, data) {
    console.log("deleted message");
    console.log(data);
  }

  function run_handler () {
      sqs.receiveMessage(receiveMessageParams, receiveMessageCallback);
  };

}