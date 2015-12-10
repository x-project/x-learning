var loopback = require('loopback');
var braintree = require('braintree');
var async = require('async');
var mandrill = require('mandrill-api/mandrill');
var mandrill_client = new mandrill.Mandrill(process.env.MANDRILL_KEY);
var moment = require('moment');
var jwt = require('jwt-simple');
var plivo = require('plivo')
var plivo_client = plivo.RestAPI({
  authId: process.env.PLIVIO_AUTH_ID_KEY,
  authToken: process.env.PLIVIO_AUTH_TOKEN
});

var gateway = braintree.connect({
  environment: braintree.Environment.Sandbox,
  merchantId: process.env.BRAINTREE_MERCHANT_ID,
  publicKey: process.env.BRAINTREE_PUBLIC_KEY,
  privateKey: process.env.TOKEN_SECRET_BRAINTREE
});

module.exports = function (Member) {

  function getCurrentUserId() {
    var ctx = loopback.getCurrentContext();
    var accessToken = ctx && ctx.get('accessToken');
    var userId = accessToken && accessToken.userId;
    return userId;
  }

  function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
  }

  Member.change_email = function (confirm, email, password, callback) {
    if (confirm !== email) {
      callback(new Error('email not confirmed'), null);
      return;
    }

    var user;
    var user_id = getCurrentUserId();

    var on_find_user = function (err, res) {
      if (err) {
        callback(err, null);
        return;
      }
      user = res;
      user.hasPassword(password, on_match_password);
    }

    var on_match_password = function (err, match) {
      if (!match) {
        callback(new Error('invalid password'), null);
        return;
      }
      user.updateAttribute('email', confirm, on_update_email);
    }

    var on_update_email = function (err, user) {

      if (err) {
        callback(err, null);
        return;
      }
      callback(null, true);
    };

    Member.findById(user_id, on_find_user);
  };


  Member.change_password = function (new_password, confirm_password, old_password, callback) {
    if (new_password !== confirm_password) {
      callback(new Error('password not confirmed'), null);
      return;
    }

    var user;
    var user_id = getCurrentUserId();

    var on_find_user = function (err, instance) {
      if (err) {
        callback(err, null);
        return;
      }
      user = instance;
      user.hasPassword(old_password, on_match_password);
    };

    var on_match_password = function (err, match) {
      if (!match) {
        callback(new Error('invalid password'), null);
        return;
      }
      user.updateAttribute('password', new_password, on_update_password);
    };

    var on_update_password = function (err, user) {
      if (err) {
        callback(err, null);
        return;
      }
      callback(null, true);
    };

    Member.findById(user_id, on_find_user);

  };

  //payment
  Member.get_client_token = function (customer_id, callback) {
    gateway.customer.find(customer_id, function (err, customer) {
      if (err) {
        callback(err, null);
        return;
      }
      gateway.clientToken.generate({ customerId: customer_id }, function (err, response) {
        if (err) {
          callback(err, null);
          return;
        }
        callback(null, response);
      });
    });
  };

  var get_access_token_member =  function (data) {
    return function (next) {
      var accessTokens = Member.relations.accessTokens;
      Member.relations.accessTokens.modelTo.findById(data.member_token, function (err, token) {
        data.token = token.userId;
        setImmediate(next, err);
      });
    };
  };

  var get_member = function (data) {
    return function (next) {
      Member.findById(data.token, function (err, user) {
        data.member = user;
        setImmediate(next, err);
      });
    };
  };

  var get_course = function (data) {
    return function (next) {
      Member.app.models.Course.findById(data.course_id, function (err, course) {
        data.course = course;
        setImmediate(next, err);
      });
    };
  };


  var braintree_checkout = function (data) {
    return function (next) {
      var transaction = gateway.transaction;
      var sale_data = {
        amount: 1,//data.course.cost,
        paymentMethodNonce: data.payment_method_nonce,
        options: {
          submitForSettlement: true
        }
      };
      transaction.sale(sale_data, function (err, res) {
        if (res.errors !== undefined) {
          var err_detail = {
            params: res.params,
            success: res.success,
            message: res.message
          };
          data.authorization_error = err_detail;
          data.payment_status = {};
          data.payment_status = res.success;
          setImmediate(next, null);
          return;
        }
        data.payment_status = res;
        setImmediate(next, null);
      });
    };
  };


  Member.checkout_braintree = function (payment_method_nonce,input_data, callback) {

    var data = {};
    data.member_token = input_data.member_token;
    data.course_id = input_data.course;

    data.payment_system = 'braintree';
    data.payment_method_nonce = payment_method_nonce;
    data.data_client_response = {};

    async.waterfall([
      get_access_token_member(data),
      get_member(data),
      get_course(data),
      braintree_checkout(data),
      Member.prepare_order_review_braintree(data),
      Member.save_payment_braintree(data),
      Member.allow_member_course(data),
      create_fail_task_braintree(data)
    ],

    function (err) {
      if (err) {
        callback(err,null);
        return;
      }
      callback(null, {
        success: data.payment_status.success,
        error: data.authorization_error
      });
    });
  };

  Member.save_payment_braintree = function (data) {
    return function (next) {
      if(!data.payment_status) {
        next();
        return;
      }
      if(data.payment_status.transaction.status !== 'submitted_for_settlement'){
        next();
        return;
      }
      if(data.payment_status.transaction.status === 'submitted_for_settlement') {
        var payment = { payment_method: data.payment_system,
          member_id: data.member.id,
          course_id: data.course.id,
         payment: data.payment_status};

        Member.app.models.Payment.create(payment, function (err, model) {
          if(err){
            next();
            return;
          }
          setImmediate(next, err);
        });
      }
    };
  };

  Member.allow_member_course = function(data){
    return function (next) {
      if(!data.payment_status) {
        next();
        return;
      }
      if(data.payment_status.transaction.status !== 'submitted_for_settlement') {
        next();
        return;
      }
      if(data.payment_status.transaction.status === 'submitted_for_settlement') {
        var member_course = {
          memberId: data.member.id
         };
        var part = data.course.students.build(member_course);
        data.course.students.add(part.memberId, function (err, model) {
          setImmediate(next, err);
          return;
        });
      }
    }
  };

  Member.prepare_order_review_braintree = function (data) {
    return function (next) {
      if (!data.payment_status) {
        next();
        return;
      }
      if (data.payment_status.transaction.status !== 'submitted_for_settlement') {
        next();
        return;
      }
      if(data.payment_status.transaction.status === 'submitted_for_settlement') {
        var reviews = get_reviews(data);
        Member.app.models.Review.create(reviews, function (err, model) {
          setImmediate(next, err);
          return;
        });
      }
    };
  };

  var get_reviews = function (data) {
    var review;
    review = {};
    review.member_id = data.member.id;
    review.course_id = data.course.id;
    review.closed = false;
    review.title = '';
    review.text = '';
    review.rating = 0;

    return review;
  };

var get_task_braintree = function (data) {
    var date_now = moment().format().split('+')[0] + 'Z';
    var task = {
      data: {
        member_id: data.member.id,
        course_id: data.course,
        transaction_id: data.payment_status.transaction.id,
        error: 'data.payment_status'
      },
      handler: 'retry_payment',
      created_at: date_now,
      priority: 'medium',
      last_retry_at: date_now,
      retry_count: 1,
      done: false
    };
    return task;
  };

  var create_fail_task_braintree = function (data) {
    return function (next) {
      if (!data.payment_status) {
        next();
        return;
      }
      if (data.payment_status.success) {
        next();
        return;
      }
      if (!data.payment_status.success) {
        Member.app.models.Task.create(get_task_braintree(data), function (err, model) {
          setImmediate(next, err);
          return;
        });
      }
    };
  };

  // passwordless for email
  Member.get_token_email = function (email, first_name, last_name, callback) {
    var data = {};
    data.email = email;
    data.first_name = first_name;
    data.last_name = last_name;
    data.new_customer = {
      first_name: 'unknown',
      last_name: 'unknown',
      email: data.email,
      password: '3208932443232987832932'
    };

    async.waterfall([
      get_customer_by_email(data),
      create_new_customer(data),
      create_token(data),
      send_signed_url_by_email(data)
    ],
    function (err) {
      if (err) {
        callback(err, null);
        return;
      }
      callback(null, data.email_result);
    });
  };

  var create_new_customer = function (data) {
    return function (next) {
      if (data.customer != null) {
        next();
        return;
      }
      Member.create(data.new_customer, function (err, model) {
        data.customer = model;
        setImmediate(next, err);
      });
    };
  };

  var get_customer_by_email = function (data) {
    return function (next) {
      var query = { where: {email: data.email} };
      Member.findOne(query, function (err, model) {
        data.customer = model;
        setImmediate(next, err);
      });
    };
  };

  var create_token = function (data) {
    return function (next) {
      var payload = {
        sub: data.customer.id,
        iat: moment().unix(),
        exp: moment().add(1, 'days').unix()
      };
      var token = jwt.encode(payload, process.env.TOKEN_SECRET_ENTER_EMAIL);
      data.token =  token;
      data.customer.last_enter_token = token;
      Member.upsert(data.customer, function (err, model) {
        data.customer = model;
        setImmediate(next, err);
      });
    };
  };

  var send_signed_url_by_email = function (data) {
    return function (next) {
      var message = prepare_mail(data.email, data.token);
      mandrill_client.messages.send({"message": message},
        function (res) {
          data.email_result = res;
          setImmediate(next, null);
        },
        function (err) {
          setImmediate(next, err);
        }
      );
    };
  };

  var prepare_mail = function (destination_email, enter_token) {
    var host = 'http://localhost:3000/';
    var link = host + 'enter?token=' + enter_token;
    var signed_url = '<a href="' + link + '">' + link + '</a>';
    var message = {
      "html": signed_url,
      "text": "click from url for sign in",
      "subject": "signed url",
      "from_email": process.env.MY_EMAIL,
      "from_name": "x-learning",
      "to": [{
              "email": destination_email,
              "name": "x-learning",
              "type": "to"
          }],
      "headers": {
          "Reply-To": process.env.MY_EMAIL
      },
      "subaccount": "12345",
    };
    return message;
  };

  Member.get_token_sms = function (phone, callback) {
    var data = {};
    data.phone = phone;
    data.new_customer = {
      first_name: 'unknown',
      last_name: 'unknown',
      email: 'unknown32089' + getRandomInt(1, 10000000000000)+ '@email.com',
      password: '3208932443232987832932',
      phone: data.phone
    };
    async.waterfall([
      get_customer_by_phone(data),
      create_new_customer(data),
      create_sms_code(data),
      send_sms(data)
    ],
    function (err) {
      if (err) {
        callback(err, null);
        return;
      }
      callback(null, data.response);
    });
  };
  var get_customer_by_phone = function (data) {
    return function (next) {
      var query = { where: {phone: data.phone} };
      Member.findOne(query, function (err, model) {
        data.customer = model;
        setImmediate(next, err);
      });
    };
  };

  var create_sms_code = function (data) {
    return function (next) {
      var code = getRandomInt(10000, 1000000);
      data.code = code;
      var payload = {
        sub: data.customer.id + '' + data.code,
        iat: moment().unix(),
        exp: moment().add(1, 'days').unix()
      };
      var token = jwt.encode(payload, process.env.TOKEN_SECRET_ENTER_SMS);
      data.token =  token;
      data.customer.last_sms_token = token;
      Member.upsert(data.customer, function (err, model) {
        data.customer = model;
        setImmediate(next, err);
      });
    };
  };

  var send_sms = function (data) {
    return function (next) {
      var params = {
        'src': process.env.PHONE_SRC,
        'dst' : data.phone,
        'text' : "Your code for login is: " + data.code,
        'url' : "http://example.com/report/",
        'method' : "GET"
      };
      plivo_client.send_message(params, function (status, response) {
        data.response = { status: status, response: response };
        setImmediate(next, null);
      });
    };
  };

  Member.try_enter_sms = function (phone, code, callback) {
    var query = { where: {phone: phone} };
    Member.findOne(query, function(err, customer) {
      if (!customer) {
        callback(null, {invalid_input: 'customer not found', success: false});
        return;
      }
      var payload = jwt.decode(customer.last_sms_token, process.env.TOKEN_SECRET_ENTER_SMS);
      if (payload.sub !== customer.id + '' + code) {
        callback(null, {invalid_input: 'invalid code',  success: false });
        return;
      }
      create_access_token(customer, function (err, user_profile) {
        if (err) {
          callback(err, null);
          return;
        }
        user_profile.success = true;
        callback(null, user_profile);
      });
    });
  };
  
  var create_access_token = function (user, callback) {
    user.createAccessToken(Member.settings.ttl, function (err, token) {
      if (err) {
        callback(err, null);
        return;
      }
      var _token = JSON.parse(JSON.stringify(token));
      var _user = JSON.parse(JSON.stringify(user));
      delete _user.password;
      delete _user.last_enter_token;
      _user.id = _token.userId;
      _token.user = _user;
      callback(null, _token);
    });
  };


  Member.remoteMethod('change_password', {
    http: { path: '/change_password', verb: 'post' },
    accepts: [
      { arg: 'new_password', type: 'string' },
      { arg: 'confirm_password', type: 'string' },
      { arg: 'old_password', type: 'string' }
    ],
    returns: { arg: 'changed', type: 'boolean' }
  });



  Member.on('resetPasswordRequest', function (info) {
    // console.log(info.user); // the requested user
    // console.log(info.email); // the email of the requested user
    // console.log(info.accessToken); // the temp access token to allow password reset
    // TODO: send email to user
  });

  Member.remoteMethod('get_token_email', {
    accepts: [
      { arg: 'email', type: 'string', required: true },
      { arg: 'first_name', type: 'string', required: true },
      { arg: 'last_name', type: 'string', required: true }
    ],
    returns: { arg: 'result', type: 'object' },
    http: { path: '/enter_token', verb: 'post' }
  });
  /*
    * passwordless by sms
  */
  Member.remoteMethod('get_token_sms', {
    accepts: { arg: 'phone', type: 'number', required: true },
    returns: { arg: 'result', type: 'object' },
    http: { path: '/get_token_sms', verb: 'post' }
  });

  Member.remoteMethod('try_enter_sms', {
    accepts: [
      { arg: 'phone', type: 'number', required: true },
      { arg: 'code', type: 'string', required: true }
    ],
    returns: { arg: 'result', type: 'object' },
    http: { path: '/enter_sms', verb: 'post' }
  });

  Member.remoteMethod('get_client_token', {
    accepts: { arg: 'customer_id', type: 'string', required: true },
    returns: { arg: 'token', type: 'object' },
    http: { verb: 'post', path:'/client_token' }
  });

  Member.remoteMethod('checkout_braintree', {
    accepts: [
      { arg: 'payment_method_nonce', type: 'string' },
      { arg: 'data', type: 'object' }
    ],
    returns: { arg: 'result', type: 'object' },
    http: { verb: 'post', path:'/checkout' }
  });

  Member.remoteMethod('change_email', {
    http: { path: '/change_email', verb: 'post' },
    accepts: [
      { arg: 'email', type: 'string' },
      { arg: 'confirm', type: 'string' },
      { arg: 'password', type: 'string' }
    ],
    returns: { arg: 'changed', type: 'boolean' }
  });

};