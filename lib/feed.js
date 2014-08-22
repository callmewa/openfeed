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
var commentUtil = require('./comment');

// TODO: remove dbClient example
//dbClient.execute('SELECT user_id FROM user_post WHERE user_id=?', ['a09e1a00-1dcb-11e4-8aff-eff726afad06'],
//   function(err, result) {
//     if (err) console.log('execute failed: ' + err);
//     else console.log('*** got user profile with name ' + result.rows[0].user_id);
//   }
//);

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
    // Note (kpan), we may need KEYS.FEED to be a sorted set so post being
    // commented recently can surface to the top of a feed. We hold the feature
    // for now. Not sure whether we want to implement it.
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
    console.log("addPostAfterCheck hset KEYS.POSTS for " + userPost.postId);
    // Save the post into Redis.
    return Q.ninvoke(client, 'hset', KEYS.POSTS, userPost.postId, JSON.stringify(userPost));
  }).then(function (result) {
        // success
        cb(null, result);

        // fan-out to followers' and self's feed in Reis and db. Fire-and-forget.
        fanOutPostToFollowers(userPost.userId, userPost.postId);
        // If it is product post, write to user_products table in db. Fire-and-forget.
        if (userPost.isProduct) {
          postUtil.saveToUserProducts(userPost);
        }

        // Update category_posts table for the post. Fire-and-forget.
        postUtil.saveToCategoryPosts(
            userPost.postCategory,
            userPost.postId,
            userPost.timeLastupdated);

        // Update category-based Redis sorted set for posts. Fire-and-forget.
        postUtil.updateCategoryPostsInRedis(
            userPost.postCategory, userPost.postId, userPost.timeLastupdated);
      },
      function(err) {
        //error
        console.trace("addPostAfterCheck part 1 error " + err);
        cb(err);
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
 * If the commenterUserId is not the same as postAuthorUserId,
 * add points to the commenter.
 * @param commenterUserId
 * @param postAuthorUserId
 */
function maybeAddPointsToCommenter(commenterUserId, postAuthorUserId) {
  if (commenterUserId !== postAuthorUserId) {
    points.addPointsForMyComment(commenterUserId);
  }
}

/**
 * If the commenterUserId is not the same as postAuthorUserId,
 * add points to the user of the post.
 * @param commenterUserId
 * @param postAuthorUserId
 */
function maybeAddPointsToPostAuthor(commenterUserId, postAuthorUserId) {
  if (commenterUserId !== postAuthorUserId) {
    points.addPointsForTheirComment(postAuthorUserId);
  }
}

/**
 * Add comment after confirming that Redis is available.
 */
function addCommentAfterCheck(comment, postAuthorUserId, postCategory, cb) {
  if (cb === undefined) {
    cb = redis.print;
  }
  
  // Add points to commenter.
  Q.fcall(maybeAddPointsToCommenter, comment.commenterUserId, postAuthorUserId)
  .then(function() {
    //Add points to the author of the points
    return Q.fcall(
        maybeAddPointsToPostAuthor, comment.commenterUserId, postAuthorUserId);
  }).then(function () {
    // Save comment into db
    return commentUtil.saveToDb(comment);
  }).then(function () {
    // Insert the comment id to post's comment list in Redis
    console.log("addCommentAfterCheck rpush KEYS.THREAD for postId=" +
        comment.postId + ", commentId=" + comment.commentId);
    return Q.ninvoke(
        client,
        'rpush',
        util.format(KEYS.THREAD, comment.postId),
        comment.commentId);
  }).then(function() {
    // Save the comment in Redis
    console.log("hset KEYS.COMMENTS for commentId=" + comment.commentId);
    return Q.ninvoke(
        client,
        'hset',
        KEYS.COMMENTS,
        comment.commentId,
        JSON.stringify(comment));
  }).then(
    function(result) {
      // Success
      cb(null, result);
      
      // Update time_lastupdated in category_posts table for the post. 
      // Fire-and-forget.
      postUtil.saveToCategoryPosts(
          postCategory,
          comment.postId,
          comment.timeCreated);

      // Update category-based Redis sorted set for posts. Fire-and-forget.
      postUtil.updateCategoryPostsInRedis(
          postCategory, comment.postId, comment.timeCreated);
    },
    function(err) {
      //error
      console.trace("addCommentAfterCheck part 1 error " + err);
      cb(err);
    }
  );
}

/**
 * add a comment to a post.
 * Add the post to db first. If succeeded, add it to Redis.
 * Thread list: RedisKey = "thread:{postId}"
 * Comments Hash: RedisKey = "comments"; hashKey = {commentId}
 * @param comment
 * @param postAuthorUserId the user id of the author of the post
 * @postCategory the category of the post
 * @param cb
 */
function addComment(comment, postAuthorUserId, postCategory, cb){
  redisUtil.checkAvailable(function (err) {
    if (err) {
      cb(new Error("Server resouce is not available"));
    } else {
      addCommentAfterCheck(comment, postAuthorUserId, postCategory, cb);
    }
  });
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

//var newPostId = cql.types.timeuuid();
//addPost(postUtil.UserPost.createPost(
//  newPostId,
//  "pkdebug",
//  "R",
//  "3m",
//  null,
//  "It is a test",
//  null,
//  null,
//  null,
//  null,
//  null,
//  "P",
//  false,
//  null,
//  null,
//  false,
//  0,
//  0,
//  false,
//  null),
//  function (err) {
//    if (err) {
//      console.err("err:" + err);
//    } else {
//      console.log('debug success');
//      addComment(commentUtil.Comment.createComment(
//          newPostId,
//          cql.types.timeuuid(),
//          'debugcomment',
//          'unit test',
//          null,
//          null,
//          false,
//          false,
//          null,
//          null,
//          null
//          ), 'pkdebug', '3m');
//    }
//  });

//fanOutPostToFollowers('pkdebug', 'c938a8a0-27f2-11e4-8ab5-11145f33bdaf');
exports.addPost = addPost;
exports.getPost = getPost;
exports.likePost = likePost;
exports.getPostLikes = getPostLikes;
exports.addComment = addComment;
exports.getThread = getThread;
exports.publishPostToFeeds = publishPostToFeeds;
exports.getFeed = getFeed;

//TODO (wa): unit test failed for addPost.
