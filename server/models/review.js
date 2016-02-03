var async = require('async');

module.exports = function (Review) {


  var get_review = function (data) {
    return function (next) {
      var filter = {where: { course_id: data.course_id }};

      Review.find( filter, function (err, model) {
        data.review = model;
        setImmediate(next, err);
      });
    };
  };

  var destroy_replies = function (data) {
    return function (next) {
      for (var i = 0; i < data.review.length; i++) {
        data.review[i].replies.destroyAll(function (err, info, num) {
        setImmediate(next, null);
      });
    };

    };
  };

  Review.observe('before delete', function(ctx, callback) {
    var data = {};
    data.course_id = ctx.where.review_id;
    console.log("review :" + ctx.where.review_id)
    async.waterfall([
        get_review(data),
        destroy_replies(data)
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