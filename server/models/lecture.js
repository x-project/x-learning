var async = require('async');

module.exports = function (Lecture) {
  
  var get_lecture = function (data) {
    return function (next) {
      var filter = {where: { course_id: data.course_id }};

      Lecture.find( filter, function (err, model) {
        data.lecture = model;
        setImmediate(next, err);
      });
    };
  };

  var destroy_videos = function (data) {
    return function (next) {
      for (var i = 0; i < data.lecture.length; i++) {
        data.lecture[i].video.destroy(function (err) {
          setImmediate(next, null);
        });
      };

      setImmediate(next, null);
    };
  };

    var get_lecture_by_id = function (data) {
    return function (next) {
      Lecture.findById(data.lecture_id, function (err, model) {
        data.lecture = model;
        console.log(data.lecture)
        setImmediate(next, err);
      });
    };
  };

  var destroy_video = function (data) {
    return function (next) {
        data.lecture.video.destroy(function (err) {
          setImmediate(next, null);
        });
    };
  };

  Lecture.observe('before delete', function(ctx, callback) {
    var data = {};

    if(ctx.where.course_id){
      console.log("course: "+ctx.where.course_id)
      data.course_id = ctx.where.course_id;
     
      async.waterfall([
        get_lecture(data),
        destroy_videos(data)
      ],
      function (err) {
      if (err) {
        callback(err);
        return;
      }
      callback(null);
    });
    }else{
      console.log("lecture: " + ctx.where.id)
      data.lecture_id = ctx.where.id

      async.waterfall([
        get_lecture_by_id(data),
        destroy_video(data)
      ],
      function (err) {
      if (err) {
        callback(err);
        return;
      }
      callback(null);
    });
    }
  });
};