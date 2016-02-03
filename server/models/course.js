var async = require('async');

module.exports = function (Course) {

  var get_course = function (data) {
    return function (next) {
      Course.findById(data.course_id, function (err, model) {
        data.course = model;
        setImmediate(next, err);
      });
    };
  };

  var destroy_lecture = function (data) {
    return function (next) {
      data.course.lectures.destroyAll(function (err, info, num) {
        setImmediate(next, err);
      });
    };
  };

  var destroy_webinars = function (data) {
    return function (next) {
      data.course.webinars.destroyAll(function (err, info, num) {
        console.log(data.course.webinars);
        console.log(err,info,num)
        setImmediate(next, err);
      });
    };
  };

  var get_students = function (data) {
    return function (next) {
      data.course.students(function (err, students) {
        data.students = students;
        console.log(data.students)
        setImmediate(next, err);
      });
    };
  };


  var remove_students = function (data) {
    return function (next) {
      async.each(data.students,
        function(student, done) {
          data.course.students.remove(student, done);
        }, next);
    };
  };

  var destroy_review = function (data) {
    return function (next) {
      data.course.review.destroyAll(function (err, info, num) {
        console.log(data.course.review);
        console.log(err,info,num)
        setImmediate(next, err);
      });
    };
  };

  Course.observe('before delete', function(ctx, callback) {
    var course_id = ctx.where.id;
    var data = {};
    data.course_id = course_id;
    async.waterfall([
      get_course(data),
      destroy_lecture(data),
      destroy_webinars(data),
      destroy_review(data),
      get_students(data),
      remove_students(data)
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