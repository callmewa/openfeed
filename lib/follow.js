/**
 * This file contains logic for followers and followed by.
 */

var Q = require('q');
var dbUtil = require('./db/dbUtil');
var cql = dbUtil.cql;
var dbClient = dbUtil.dbClient;
var dbPromise = require('./db/promise');
var redisUtil = require("./redis/redisUtil");
var redis = redisUtil.redis;
var client = redisUtil.client;
var util = require('util');
var KEYS = redisUtil.KEYS;

/**
 * follows a user given the followerId
 * RedisKey = followedBy:{userId}
 * use redis set
 * @param userId
 * @param followerId
 * @param cb
 */
function followUser(userId, followerId, cb){
  if (cb === undefined) {
    cb = redis.print;
  }
  client.sadd(util.format(KEYS.FOLLOWED_BY, userId), followerId, cb);
}

function getFollowers(userId, cb){
  if (cb === undefined) {
    cb = redis.print;
  }
  client.smembers(util.format(KEYS.FOLLOWED_BY, userId), cb);
}

/**
 * Retrieve followers from db.
 * @param userId the user id
 * @returns a promise for the followers for a user from DB.
 */
function getFollowersFromDb(userId) {
  return dbPromise.genQueryPromise(
    'SELECT follower_id FROM followed_by WHERE user_id = ?',
    [userId]
  ).then(function(selectResult) {
    var followers = [];
    
    if (selectResult) {
      selectResult.rows.forEach(function (row) {
        followers.push(row.follower_id);
      });
    }
    
    return followers;
  }).fail(function (error) {
    console.error("getFollowersFromDb error " + error);
    throw error;
  });
}

exports.followUser = followUser;
exports.getFollowers = getFollowers;
exports.getFollowersFromDb = getFollowersFromDb;

// TODO (kpan): add unit tests 