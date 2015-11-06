var request = require('superagent');
var faker = require('faker');
var fs = require('fs');

module.exports = function (server) {

var START = true;

var models = {};

server.models().forEach(function (model) {
  var model_name = model.definition.name;
  models[model_name] = model;
});

faker.model = {};

faker.model.Category = function () {
  return {
    title: faker.commerce.department(),
    description: faker.lorem.paragraph()
  };
};

faker.model.Course = function () {
  return {
    title: faker.name.firstName(),
    description: faker.lorem.sentence(),
    date: faker.date.past(),
    cover: 'http://www.asroma.it/images/wallpaper/wallpaper1920x1080.jpg',
    category_id: faker.random.model('Category').id
    // teacher_id: faker.random.model('User').id
  };
};

faker.model.Lecture = function () {
  return {
    title: faker.commerce.department(),
    description: faker.lorem.paragraph(),
    course_id: faker.random.model('Course').id,
    video_id: faker.random.model('Video').id
  };
};

faker.model.Member = function () {
  return {
    name: faker.name.firstName(),
    last_name: faker.lorem.sentence(),
    email: faker.internet.email(),
    password: '123',
    photo: 'http://www.caos.museum/wp-content/uploads/2015/05/narciso.jpg',
    location: faker.address.streetAddress(),
    follow_course_id: faker.random.model('Course').id,
    offered_course_id: faker.random.model('Course').id
    // teacher_id: faker.random.model('User').id
  };
};

faker.model.Video = function () {
  return {
    url: 'http://d1s3yn3kxq96sy.cloudfront.net/bigbuckbunny/index.m3u8'
  };
};

faker.random.model = function (model_name) {
  var models = faker.random[model_name];
  if (!models.length) {
    return {};
  }
  var index = faker.random.number(models.length - 1);
  var model = models[index];
  return model;
};

var upto = function (n, iterator) {
  var defer = Promise.defer();
  var promise = defer.promise;

  var completed = 0;

  var complete = function () {
    completed += 1;
    if (completed >= n) {
      defer.resolve();
      return;
    }
    iterate();
  };

  var iterate = function () {
    iterator(completed)
      .then(complete)
      .catch(defer.reject);
  };

  if (n === 0) {
    defer.resolve();
    return promise;
  }

  iterate();

  return promise;
};

var init = function () {
  var defer = Promise.defer();

  defer.resolve();

  return defer.promise;
};

var destroy = function (model_name) {
  return function () {
    var defer = Promise.defer();

    models[model_name].destroyAll(function (err, info) {
      if (err) {
        defer.reject(err);
        return;
      }
      defer.resolve(info);
    });

    return defer.promise;
  };
};

var fake = function (model_name, n) {

  var iterator = function (i) {
    // console.log('fake', model_name, i);

    var defer = Promise.defer();
    var data = faker.model[model_name]();

    faker.random[model_name] = faker.random[model_name] || [];

    var res = models[model_name].create(data, function (err, model) {
      if (err) {
        defer.reject(err);
        return;
      }
      faker.random[model_name].push(model);
      defer.resolve(model);
    });

    return defer.promise;
  };

  return function () {
    return upto(n, iterator);
  }
};

function start () {
  init()
    .then(destroy('Category'))
    .then(destroy('Video'))
    .then(destroy('Course'))
    .then(destroy('Member'))
    .then(destroy('Lecture'))
    .then(fake('Category', 10))
    .then(fake('Video', 5))
    .then(fake('Course', 20))
    .then(fake('Member', 10))
    .then(fake('Lecture', 80))
    .then(function () {
      console.log('yeah!');
    })
    .catch(function (err) {
      console.log('oops!');
      console.warn(err);
    });
}

if (START) {
  start();
}

};