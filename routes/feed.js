/**
 * Created by wa on 8/31/14.
 */
var FeedService = require("../lib/feedService"),
  service = new FeedService(),
  redisFeed = require("../lib/redisDelegate"),
  utils = require("../lib/utils"),
  moment = require("moment");

service.addDelegate(redisFeed);

exports.addFollower = function(req, res) {
  var userId = req.body.userId;
  var followerId = req.body.followerId;
  service.followUser(userId, followerId, function(error, result){
    console.log(result);
    res.status(200).end(""+ result);
  });
};

exports.addPost = function (req, res) {
  var post = req.body.post;
  post.postId = utils.genId();
  post.timeMsCreated = moment().valueOf();
  service.addPost(post, function(error, result){
    console.log("addPost, result=" + result);
    res.status(200).end(""+ result);
  });
};

exports.getFeed = function (req, res) {
  var loadFeedParams = {};
  loadFeedParams['userId'] = req.query.user_id;
  loadFeedParams['timeMsInsertedSince'] = req.query.time_ms_inserted_since;
  loadFeedParams['maxToFetch'] = req.query.max_to_fetch;
  loadFeedParams['largestInsertTimeAtClient'] = req.query.largest_insert_time_at_client;
  service.getFeed(loadFeedParams, function(error, result){
    res.status(200).json(result);
  });
};