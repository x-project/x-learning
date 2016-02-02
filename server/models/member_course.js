var loopback = require('loopback');

module.exports = function (MemberCourse) {
  var get_access_token_member =  function (data) {
    return function (next) {
      var accessTokens = Member.relations.accessTokens;
      Member.relations.accessTokens.modelTo.findById(data.member_token, function (err, token) {
        data.token = token.userId;
        setImmediate(next, err);
      });
    };
  };

   var get_access_token_member =  function (data) {
      var accessTokens = MemberCourse.app.models.Member.relations.accessTokens;
      MemberCourse.app.models.Member.relations.accessTokens.modelTo.findById(data, function (err, token) {
        console.log(data)
        data.token = token.userId;
      });
  };

  function getCurrentUserId() {
    var ctx = loopback.getCurrentContext();
    var accessToken = ctx && ctx.get('token');
    var userId = accessToken && accessToken.userId;
    return userId;
  }

  MemberCourse.authorizated = function(data,callback){
    //{ "where": { "memberId": "5649b02de567d38f03376459" } }
      // var user_id = getCurrentUserId();
      var user_id = {};
      user_id.token = data
      get_access_token_member(user_id);
      console.log(user_id)
      var query = { "where": {"memberId": user_id} };
      MemberCourse.findOne(query, function (err, model) {
        console.log(model)
        if(!model){
          callback(err, null);
          return;
        }else{
          callback(null, true);
        }
      });
      return false;
  }

  MemberCourse.remoteMethod('authorizated', {
    accepts: { arg: 'data', type: 'string', required: true },
    returns: { arg: 'result', type: 'boolean' },
    http: { verb: 'get', path:'/authorizated' }
  });
};
