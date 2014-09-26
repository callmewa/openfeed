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
  var post = req.body;
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

exports.addComment = function (req, res) {
  var postComment = req.body;
  postComment.commentId = utils.genId();
  postComment.timeMsCreated = moment().valueOf();
  service.addComment(postComment, function(error, result){
    console.log("addComment, result=" + result);
    res.status(200).end(""+ result);
  });
};

exports.getThread = function (req, res) {
  var loadCommentsParams = {};
  loadCommentsParams['postId'] = req.query.post_id;
  loadCommentsParams['timeMsCreatedSince'] = req.query.time_ms_created_since;
  loadCommentsParams['maxToFetch'] = req.query.max_to_fetch;
  service.getThread(loadCommentsParams, function(error, result){
    res.status(200).json(result);
  });
};

exports.likePost = function (req, res) {
  var postLike = req.body;
  service.likePost(postLike, function(error, result){
    console.log("likePost, result=" + result);
    res.status(200).end(""+ result);
  });
};
