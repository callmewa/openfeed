/**
 * This file contains logic for a points system.
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
var dbPromise = require('./db/promise');
var systemSettings = require('./systemSettings');

/**
 * @param userId the user name
 * @param pointsChange the points changed. It can be negative
 * @param note note of reason for points change
 * @returns promise
 */
function changePoints(userId, pointsChange, note) {
  var timeUuid = cql.types.timeuuid();
  
  return dbPromise.genQueryPromise(
    'INSERT INTO points_statement ' +
      '(user_id, statement_id, points_change, time_updated, note) ' +
    'VALUES (?, ?, ?, dateof(now()), ?)',
    [userId,
     timeUuid,
     {value: pointsChange, hint: cql.types.dataTypes.bigint},
     note]
  )
  .then(function() {
    return dbPromise.genQueryPromise(
        'UPDATE user_points SET points = points + ? WHERE user_id = ?',
        [{value: pointsChange, hint: cql.types.dataTypes.bigint}, userId],
        cql.types.consistencies.all);
    })
  .then(function() {
    return dbPromise.genQueryPromise(
        'SELECT points FROM user_points WHERE user_id = ?',
        [userId]);
    })
  .then(function(selectResult) {
    var userPoints = selectResult.rows[0].points;
    if (userPoints) {
      // Update Redis with the latest poinst for the user.
      client.set(util.format(KEYS.USER_POINTS, userId), userPoints);
    }
  })
  .fail(function (error) {
    console.error("changePoints error " + error);
    throw error;
  });
}

/**
 * Add user points for a new post the user posted
 * @param userId
 * @returns promise
 */
function addPointsForNewPost(userId) {
  var newPostPoints = systemSettings.getNewPostPoints();
  var note = "Awarded " + newPostPoints + " points for posting a new post.";
  return changePoints(userId, newPostPoints, note);
}

/**
 * Add user points for a new comment the user posted
 * @param userId
 * @returns promise
 */
function addPointsForMyComment(userId) {
  var myCommentPoints = systemSettings.getMyCommentPoints();
  var note = "Awarded " + myCommentPoints + " points for posting a comment.";
  return changePoints(userId, myCommentPoints, note);
}

/**
 * Add user points for other user comments on this user's post.
 * @param userId
 * @returns promise
 */
function addPointsForTheirComment(userId) {
  var theirCommentPoints = systemSettings.getTheirCommentPoints();
  var note = "Awarded " + theirCommentPoints + " points for other users' comment.";
  return changePoints(userId, theirCommentPoints, note);
}

/**
 * Add user points for other user liking this user's post.
 * @param userId
 * @returns promise
 */
function addPointsForTheirLike(userId) {
  var theirLikePoints = systemSettings.getTheirLikePoints();
  var note = "Awarded " + theirLikePoints + " points for other users' like.";
  return changePoints(userId, theirLikePoints, note);
}

/**
 * Get user points from Redis for a user
 * @param userId
 * @param cb
 */
function getPointsFromMemory(userId, cb) {
  if(cb === undefined) {
    cb = redis.print;
  }
  client.get(util.format(KEYS.USER_POINTS, userId), cb);
}

//changePoints('pkdebug9', 100, 'unit test');
exports.getPointsFromMemory = getPointsFromMemory;
exports.addPointsForNewPost = addPointsForNewPost;
exports.changePoints = changePoints;

// TODO (kpan): add unit tests for addPoints* functions.