/**
 * Created by zwang on 7/30/14.
 */

var redisUtil = require("./redis/redisUtil");
var redis = redisUtil.redis;
var client = redisUtil.client;
var KEYS = redisUtil.KEYS;
var moment = require("moment");
var util = require('util');
var Q = require('q');
var dbUtil = require('./db/dbUtil');
var cql = dbUtil.cql;
var dbClient = dbUtil.dbClient;
var postUtil = require('./post');

// TODO: remove dbClient example
// dbClient.execute('SELECT user_id, fname, lname FROM users WHERE user_id=?', [1745],
//   function(err, result) {
//     if (err) console.log('execute failed: ' + err);
//     else console.log('got user profile with name ' + result.rows[0].fname);
//   }
// );

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
 * Add post after confirming that Redis is available.
 */
function addPostAfterCheck(post, cb){
  if (cb === undefined) cb = redis.print;
  
  // Pseudo code
  // Add user points.
  // post.genSaveToDbPromise() or genSaveProductToDbPromise()
  // .then(function() {
  //    // Save the post into Redis.
  //    client.hset(KEYS.POSTS, post.postId, JSON.stringify(post), cb);
  // }).then(function() {
  //    // fan-out to followers' feed in db. Fire-and-forget.
  //    // If it is product post, write to user_products table in db.
  //    // Update category-based Redis sorted set for posts
  // }).fail(function (error) {
  //    console.trace("addPostAfterCheck error " + error);
  // });
  client.hset(KEYS.POSTS, post.postId, JSON.stringify(post), cb);
}

/**
 * add a post to a post pool.
 * Add the post to db first. If succeeded, add it to Redis. We need to
 * check the available of Redis server first before we insert the post
 * into db to reduce the possibility of data inconsistency between Redis 
 * and DB.
 * RedisKey = 'posts' ; hashKey = {postId}
 * @param post
 * @param cb
 */
function addPost(post, cb){
  redisUtil.checkAvailable(function (err) {
    if (err) {
      cb(new Error("Server resouce is not available"));
    } else {
      addPostAfterCheck(post, cb);
    }
  });
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

exports.Comment = Comment;
exports.followUser = followUser;
exports.getFollowers = getFollowers;
exports.addPost = addPost;
exports.getPost = getPost;
exports.likePost = likePost;
exports.getPostLikes = getPostLikes;
exports.addComment = addComment;
exports.getThread = getThread;
exports.publishPostToFeeds = publishPostToFeeds;
exports.getFeed = getFeed;

//TODO (wa): unit test failed for addPost.