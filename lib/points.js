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
var cql = require('node-cassandra-cql'),
  dbClient = new cql.Client({hosts: ['localhost'], keyspace: 'myks'});
var dbPromise = require('./db/promise');
var systemSettings = require('./systemSettings');

/**
 * @param userId the user name
 * @param pointsChange the points changed. It can be negative
 * @param note note of reason for points change
 */
function changePoints(userId, pointsChange, note) {
  var timeUuid = cql.types.timeuuid();
  
  dbPromise.genQueryPromise(
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
    console.error("db error " + error);
  });
}

/**
 * Add user points for a new post the user posted
 * @param userId
 */
function addPointsForNewPost(userId) {
  var newPostPoints = systemSettings.getNewPostPoints();
  var note = "Awarded " + newPostPoints + " points for posting a new post.";
  changePoints(userId, newPostPoints, note);
}

/**
 * Add user points for a new comment the user posted
 * @param userId
 */
function addPointsForMyComment(userId) {
  var myCommentPoints = systemSettings.getMyCommentPoints();
  var note = "Awarded " + myCommentPoints + " points for posting a comment.";
  changePoints(userId, myCommentPoints, note);
}

/**
 * Add user points for other user comments on this user's post.
 * @param userId
 */
function addPointsForTheirComment(userId) {
  var theirCommentPoints = systemSettings.getTheirCommentPoints();
  var note = "Awarded " + theirCommentPoints + " points for other users' comment.";
  changePoints(userId, theirCommentPoints, note);
}

/**
 * Add user points for other user liking this user's post.
 * @param userId
 */
function addPointsForTheirLike(userId) {
  var theirLikePoints = systemSettings.getTheirLikePoints();
  var note = "Awarded " + theirLikePoints + " points for other users' like.";
  changePoints(userId, theirLikePoints, note);
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
exports.changePoints = changePoints;
exports.getPointsFromMemory = getPointsFromMemory;
exports.client = client;

// TODO (kpan): add unit tests for addPoints* functions.