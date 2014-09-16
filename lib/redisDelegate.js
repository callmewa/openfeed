/**
 * Created by wa on 8/31/14.
 */


/**
 * Created by zwang on 7/30/14.
 */


var redis = require("redis"),
  client = redis.createClient();
var util = require('util');
var Q = require('q');

// if you'd like to select database 3, instead of 0 (default), call
// client.select(3, function() { /* ... */ });

client.on("error", function (err) {
  console.log("Error " + err);
});



//redis keys
//*FollowedBy = a list of userIds who follows the user
//*User = an individual
//*Thread = a list comments attached to a post
//*Feed = a list of posts
var KEYS = {
  FOLLOWED_BY: "followedBy:%s",
  POSTS: "posts",
  POST_LIKES: "post:likes:%s",
  THREAD: "thread:%s",
  COMMENTS: "comments",
  FEED: "feed:%s"
};

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
  client.sadd(util.format(KEYS.FOLLOWED_BY, userId), followerId, cb);
}

function getFollowers(userId, cb){
  if(cb === undefined) cb = redis.print;
  client.smembers(util.format(KEYS.FOLLOWED_BY, userId), cb);
}

/**
 * add a post to a post pool
 * RedisKey = 'posts' ; hashKey = {postId}
 * @param post
 * @param cb
 */
function addPost(post, cb){
  if(cb === undefined) cb = redis.print;
  var postJson = JSON.stringify(post);
  console.log("addPost, " + postJson);
  client.hset(KEYS.POSTS, post.postId, postJson, cb);
}

function getPost(postId, cb){
  if(cb === undefined) cb = redis.print;
  client.hget(KEYS.POSTS, postId, cb);
}


function likePost(postId, userId, cb){
  if(cb === undefined) cb = redis.print;
  client.sadd(util.format(KEYS.POST_LIKES, postId), userId, cb);
}


function getPostLikes(postId, cb){
  if(cb === undefined) cb = redis.print;
  client.smembers(util.format(KEYS.POST_LIKES, postId), cb);
}


/**
 * add a comment to a thread list as well as comment hash
 * Thread list: RedisKey = "thread:{postId}"
 * Comments Hash: RedisKey = "comments"; hashKey = {commentId}
 * @param comment
 * @param cb
 */
function addComment( comment, cb){
  if(cb === undefined) cb = redis.print;
  client.rpush(util.format(KEYS.THREAD, comment.postId), comment.commentId);
  client.hset(KEYS.COMMENTS, comment.commentId, JSON.stringify(comment), cb);
}

function getThread(postId, cb){
  Q.ninvoke(client, 'lrange', util.format(KEYS.THREAD, postId), 0, -1 )
    .then(function(comments){
      return Q.ninvoke(client, 'hmget', KEYS.COMMENTS, comments);
    })
    .done(function(results){
      cb(null, results);
    });
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
        return Q.ninvoke(client, 'rpush', util.format(KEYS.FEED, followerId), postId);
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
  client.lrange(util.format(KEYS.FEED, userId), 0, -1, cb);
}


exports.followUser = function(){
  return followUser(arguments[0].userId, arguments[0].followerId, arguments[1]);
};
exports.getFollowers = getFollowers;
exports.addPost = addPost;
exports.getPost = getPost;
exports.likePost = function(){
  return likePost(arguments[0].postId, arguments[0].userId, arguments[1]);
};
exports.getPostLikes = getPostLikes;
exports.addComment = addComment;
exports.getThread = getThread;
exports.publishPostToFeeds = function(){
  return publishPostToFeeds(arguments[0].postId, arguments[0].userId, arguments[1]);
};
exports.getFeed = getFeed;
exports.client = client;
exports.redis = redis;
