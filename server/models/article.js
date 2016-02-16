var async = require('async');
var aws = require('aws-sdk');

module.exports = function (Article) {

  /* ********************************************************* */
  /*
    * data validation
  */
  Article.validate('published_at', validate_published_at_future, { message: 'invalid past date' });

  function validate_published_at_future (err) {
    var article = this;
    if (!article.published_at) {
      return;
    }
    var published_at = new Date(article.published_at);
    var date_now = Date.now();
    var diff =  published_at - date_now;
    if (diff < 0) {
      err();
    }
  }

  function getCredentials(){
    return new Promise(function (resolve,reject){
      
      Article.app.models.Service.get_service('aws').then(function (service) {  
      aws.config.update({accessKeyId: service.public_key , secretAccessKey: service.private_key });
      aws.config.update({region: service.params.region , signatureVersion: 'v4' });
      
      s3 = new aws.S3();
      
      resolve(service)
      });
    })
  }

  var get_image = function (data) {
    return function (next) {
      Article.findById(data.article_id, function (err, model) {
        data.article = model;
        data.path = "articles/" + data.article.id + "/" +data.article.image.title;
        console.log(data.path);
        setImmediate(next, err);
      });
    };
  }

  var delete_image = function(data) {
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

  Article.observe('before delete', function(ctx, callback) {
    data = {};
    console.log(ctx)
    data.article_id = ctx.where.id;
    async.waterfall([
        get_image(data),
        delete_image(data)
      ],
      function (err) {
      if (err) {
        callback(err);
        return;
      }
      callback(null);
    });
  });
  /* ********************************************************* */
};