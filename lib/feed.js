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
var points = require('./points');
var dbPromise = require('./db/promise');
var followUtil = require('./follow');

// TODO: remove dbClient example
//dbClient.execute('SELECT user_id FROM user_post WHERE user_id=?', ['a09e1a00-1dcb-11e4-8aff-eff726afad06'],
//   function(err, result) {
//     if (err) console.log('execute failed: ' + err);
//     else console.log('*** got user profile with name ' + result.rows[0].user_id);
//   }
//);

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
 * For newly created post, fan-out the post to follower's and self's feed
 * in Redis and db.
 * @param userId the author of the post
 * @param postId post id
 */
function fanOutPostToFollowers(userId, postId) {
  var key = util.format(KEYS.FOLLOWED_BY, userId);
  Q.ninvoke(client, 'exists', key)
  .then(function(isKeyExists) {
    if (isKeyExists) {
      // Return the followers of the user from Redis
      return Q.ninvoke(client, 'smembers', key);
    } else {
      // Return the followers of the user from DB
      console.log("Fetching followers from db for, " + userId);
      return followUtil.getFollowersFromDb(userId);
    }
  }).then(function (followers) {
    console.log("followers, " + followers);
    // Push the post to author's feed too.
    followers.push(userId);
    // save the post into followers' feed table.
    var promises = followers.map(function(followerId){
      console.log("created db promise for " + postId + " to " + followerId );
      var feedId = cql.types.timeuuid();
      var insertTimeMs = moment().valueOf();
      return dbPromise.genQueryPromise(
          'INSERT INTO feed (user_id, feed_id, post_id, time_inserted) ' +
          'VALUES (?,?,?,?)',
          [followerId,
           {value: feedId, hint: cql.types.dataTypes.timeuuid},
           {value: postId, hint: cql.types.dataTypes.timeuuid},
           {value: insertTimeMs, hint: cql.types.dataTypes.timestamp}]);
    });

    // Save the post into followers' Redis key
    // TODO (kpan), KEYS.FEED should be a sorted set.
    var redisPromises = followers.map(function(followerId){
      console.log("created Redis promise for " + postId + " to " + followerId );
      return Q.ninvoke(client, 'rpush', util.format(KEYS.FEED, followerId), postId);
    });

    Q.all(promises.concat(redisPromises));
  });
}

/**
 * Add points to the author if the post is not private.
 * @param userPost
 */
function maybeAddPointsForNewPost(userPost) {
  if (postUtil.isPrivate(userPost)) {
    return;
  } else {
    points.addPointsForNewPost(userPost.userId);
  }
}

/**
 * Add post after confirming that Redis is available.
 */
function addPostAfterCheck(userPost, cb){
  if (cb === undefined) {
    cb = redis.print;
  }

  // Add user points first.
  Q.fcall(maybeAddPointsForNewPost, userPost)
  .then(function() {
    // Save the post to Cassandra DB.
    return postUtil.saveToDb(userPost);
  }).then(function() {
    console.log("hset KEYS.POSTS for " + userPost.postId);
    // Save the post into Redis.
    return Q.ninvoke(client, 'hset', KEYS.POSTS, userPost.postId, JSON.stringify(userPost));
  }).then(function (result) {
        // success
        cb();

        // fan-out to followers' and self's feed in Reis and db. Fire-and-forget.
        fanOutPostToFollowers(userPost.userId, userPost.postId);
        // If it is product post, write to user_products table in db. Fire-and-forget.
        if (userPost.isProduct) {
          postUtil.saveToUserProducts(userPost);
        }

        // Update category_posts table for the post. Fire-and-forget.
        postUtil.saveToCategoryPosts(userPost.postCategory, userPost.postId);

        var key = util.format(KEYS.CATEGORY_POSTS, userPost.postCategory);
        console.log("Save KEYS.CATEGORY_POSTS for key=" + key +
            ", postId=" + userPost.postId);
        // Update category-based Redis sorted set for posts. Fire-and-forget.
        return Q.ninvoke(client, 'ZADD', key, userPost.timeLastupdated, userPost.postId
        ).fail(function (error) {
          console.error("Error saving KEYS.CATEGORY_POSTS, error=" + error);
        });
      },
      function(err) {
        //error
        console.trace("addPostAfterCheck part 1 error " + err);
        cb(err);
  }).done(function(result){
    cb(null, result);
  });
}

/**
 * add a post to a post pool.
 * Add the post to db first. If succeeded, add it to Redis. We need to
 * check the available of Redis server first before we insert the post
 * into db to reduce the possibility of data inconsistency between Redis
 * and DB.
 * RedisKey = 'posts' ; hashKey = {postId}
 * @param userPost
 * @param cb
 */
function addPost(userPost, cb){
  redisUtil.checkAvailable(function (err) {
    if (err) {
      cb(new Error("Server resouce is not available"));
    } else {
      addPostAfterCheck(userPost, cb);
    }
  });
}

function getPost(postId, cb){
  if (cb === undefined) {
    cb = redis.print;
  }
  client.hget(KEYS.POSTS, postId, cb);
}


function likePost(postId, userId, cb){
  if (cb === undefined) {
    cb = redis.print;
  }
  client.sadd(util.format(KEYS.POST_LIKES, postId), userId, cb);
}

function getPostLikes(postId, cb){
  if (cb === undefined) {
    cb = redis.print;
  }
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
  if (cb === undefined) {
    cb = redis.print;
  }
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
  if (cb === undefined) {
    cb = redis.print;
  }

  // this is an OK example of using Q library
  // what's missing are all of the error cases which will be added later as needed

  Q.nfcall(followUtil.getFollowers, userId )
    .then(function(followers){
      var promises = followers.map(function(followerId){
        console.log("created promise for " + postId + " to " + followerId );
        return Q.ninvoke(client, 'rpush', util.format(KEYS.FEED, followerId), postId);
      });
      return Q.allSettled(promises);
    })
    .done(function(results){
      cb(null, results);
    });
}

/**
 * get the user feed
 * @param userId
 * @param cb
 */
function getFeed(userId, cb){
  if (cb === undefined) {
    cb = redis.print;
  }
  client.lrange(util.format(KEYS.FEED, userId), 0, -1, cb);
}

addPost(postUtil.UserPost.createPost(
  cql.types.timeuuid(),
  "pkdebug",
  "R",
  "3m",
  null,
  "It is a test",
  null,
  null,
  null,
  null,
  null,
  "P",
  false,
  null,
  null,
  false,
  0,
  0,
  false,
  null),
  function (err) {
    if (err) {
      console.err("err:" + err);
    } else {
      console.log('debug success');
    }
  });
//fanOutPostToFollowers('pkdebug', 'c938a8a0-27f2-11e4-8ab5-11145f33bdaf');
exports.Comment = Comment;
exports.addPost = addPost;
exports.getPost = getPost;
exports.likePost = likePost;
exports.getPostLikes = getPostLikes;
exports.addComment = addComment;
exports.getThread = getThread;
exports.publishPostToFeeds = publishPostToFeeds;
exports.getFeed = getFeed;

//TODO (wa): unit test failed for addPost.
