/**
 * Created by zwang on 7/30/14.
 */


var redis = require("redis"),
  client = redis.createClient();
var moment = require("moment");
var util = require('util');
var Q = require('q');

// if you'd like to select database 3, instead of 0 (default), call
// client.select(3, function() { /* ... */ });

client.on("error", function (err) {
  console.log("Error " + err);
});


/**
 * User Post Type
 * to create new use UserPost.create(...)
 * @type {{postId: null, userId: null, postType: null, message: null}}
 */
var UserPost = {
  postId:null,
  userId:null,
  postType: null,
  message: null,
  timestamp: null,
  edited: null,

  /**
   * Default factory method
   * consider using IdGenerator for postId
   * @param postId
   * @param userId
   * @param postType
   * @param message
   */
  createPost: function(postId, userId, postType, message){
    var obj = Object.create(this);
    obj.timestamp = moment();
    obj.postId = postId;
    obj.userId = userId;
    obj.postType = postType;
    obj.message = message;
    return obj;
  }
};

var Comment = {
  postId:null,
  commentId:null,
  userId:null,
  message:null,
  timestamp: null,
  edited:null,

  createComment: function(postId, commentId, userId, message){
    var obj = Object.create(this);
    obj.timestamp = moment();
    obj.postId = postId;
    obj.userId = userId;
    obj.commentId = commentId;
    obj.message = message;
    return obj;
  }
};

//*FollowedBy = a list of userIds who follows the user
//*User = an individual
//*Thread = a list comments attached to a post

/**
 * follows a user given the followerId
 * RedisKey = followedBy:{userId}
 * use redis set
 * @param userId
 * @param followerId
 * @param cb
 */
function followUser(userId, followerId, cb){
  if(cb === undefined) cb = redis.print;
  client.sadd(util.format('followedBy:%s', userId), followerId, cb);
}

function getFollowers(userId, cb){
  if(cb === undefined) cb = redis.print;
  client.smembers(util.format('followedBy:%s', userId), cb);
}

/**
 * add a post to a post pool
 * RedisKey = 'posts' ; hashKey = {postId}
 * @param post
 * @param cb
 */
function addPost(post, cb){
  if(cb === undefined) cb = redis.print;
  client.hset('posts', post.postId, JSON.stringify(post), cb);
}

function getPost(postId, cb){
  if(cb === undefined) cb = redis.print;
  client.hget('posts', postId, cb);
}

/**
 * public post to various feeds (list)
 * RedisKey = 'feed:%s'
 * @param postId
 * @param userId
 * @param cb
 */
function publishPostToFeeds(postId, userId, cb){
  if(cb === undefined) cb = redis.print;

  // this is an OK example of using Q library
  // what's missing are all of the error cases which will be added later as needed

  Q.nfcall(getFollowers, userId )
    .then(function(followers){
      var promises = followers.map(function(followerId){
        console.log("created promise for " + postId + " to " + followerId );
        return Q.ninvoke(client, 'rpush', util.format('feed:%s', followerId), postId);
      });
      return Q.allSettled(promises);
    })
    .done(function(results){
      cb(null, results);
    })
}

/**
 * get the user feed
 * @param userId
 * @param cb
 */
function getFeed(userId, cb){
  if(cb === undefined) cb = redis.print;
  client.lrange(util.format('feed:%s', userId), 0, -1, cb);
}

exports.UserPost = UserPost;
exports.Comment = Comment;
exports.followUser = followUser;
exports.getFollowers = getFollowers;
exports.addPost = addPost;
exports.getPost = getPost;
exports.publishPostToFeeds = publishPostToFeeds;
exports.getFeed = getFeed;
exports.client = client;
exports.redis = redis;