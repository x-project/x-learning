var loopback = require('loopback');
var braintree = require('braintree');
var async = require('async');

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
      Member.save_payment_braintree(data),
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

        var member_course = {
          memberId: data.member.id
         };
        Member.app.models.Payment.create(payment, function (err, model) {
          if(err){
            next();
            return;
          }
          var part = data.course.follow.build(member_course);
            data.course.follow.add(part.memberId, function (err, model) {
              setImmediate(next, err);
              return;
            });
        });
      }
    };
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