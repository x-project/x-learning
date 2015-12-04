var request = require('request');

module.exports = function (app) {

  var Member = app.models.Member;

  var token_secret = process.env.TOKEN_SECRET_FACEBOOK;

  var access_token_endpoint = 'https://graph.facebook.com/v2.5/oauth/access_token';

  var api_endpoint = 'https://graph.facebook.com/v2.5/me';

  function fetch_token (params) {
    return new Promise(function (resolve, reject) {

      var options = {
        url: access_token_endpoint,
        qs: params,
        json: true
      };

      request.get(options, function (err, res, token) {
        if (err) {
          reject(err);
          return;
        }
        if (res.statusCode !== 200) {
          reject(res.body);
          return;
        }
        resolve(token);
      });

    });
  }

  function fetch_profile (token) {
    return new Promise(function (resolve, reject) {
      token.fields = token.fields || 'email,first_name,gender';

      var options = {
        url: api_endpoint,
        qs: token,
        json: true
      };

      request.get(options, function (err, res, profile) {
        if (err) {
          reject(err);
          return;
        }
        if (res.statusCode !== 200) {
          reject(res.body);
          return;
        }
        resolve(profile);
      });
    });
  }

  function fetch_user (profile) {
    return new Promise(function (resolve, reject) {
      var query = { where: { or: [
        { facebook: profile.id }, { email: profile.email }
      ] } };

      Member.findOne(query, function (err, user) {

        if (err) {
          reject(err);
          return;
        }
        if (!user) {
          return create_user(profile);
        }
        if (user.facebook == undefined) {
          return update_user(profile, user);
        }
        if (user.facebook !== profile.id) {
          reject('user just connected via another Facebook account');
          return;
        }

        resolve(user);
      });
    });
  }

  function create_user (profile) {
    return new Promise(function (resolve, reject) {

      Member.create({
        name: profile.name,
        facebook: profile.id,
        email: profile.email,
        password: profile.sub
      }, function (err, user) {
        if (err) {
          reject(err);
          return;
        }

        resolve(user);
      });

    });
  }

  function update_user (profile, user) {
    return new Promise(function (resolve, reject) {

      user.facebook = profile.id;
      user.profile_name = user.name || profile.name;

      user.save(function (err) {
        if (err) {
          reject(err);
          return;
        }
        resolve(user);
      });

    });
  }

  function create_token (user) {
    return new Promise(function (resolve, reject) {

      user.createAccessToken(Member.settings.ttl, function (err, token) {
        if (err) {
          reject(err);
          return;
        }

        var _token = JSON.parse(JSON.stringify(token));
        var _user = JSON.parse(JSON.stringify(user));
        delete _user.password;
        _user.id = _token.userId;
        _token.user = _user;

        resolve(_token);
      });

    });
  }

  function auth (params) {
    return new Promise(function (resolve, reject) {

      fetch_token(params)
        .then(fetch_profile)
        .then(fetch_user)
        .then(create_token)
        .then(resolve)
        .catch(reject);

    });
  }

  app.post('/auth/facebook', function (req, res, next) {
    var params = {
      code: req.body.code,
      client_id: req.body.client_id,
      client_secret: token_secret,
      redirect_uri: req.body.redirect_uri
    };

    auth(params)
      .then(function (token) {
        res.send(token);
      })
      .catch(function (err) {
        res.status(500).send(err);
      });
  });

};