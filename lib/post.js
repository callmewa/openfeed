/**
 * This file contains logic for post.
 */

var Q = require('q');
var dbUtil = require('./db/dbUtil');
var cql = dbUtil.cql;
var dbClient = dbUtil.dbClient;
var dbPromise = require('./db/promise');

/**
 * Save user-saved post into Cassandra db.
 * @param userId the user name
 * @param postId the post id
 */
function saveUserSavedPostToDb(userId, postId) {
  dbPromise.genQueryPromise(
    'INSERT INTO saved_posts ' +
      '(user_id, post_id, time_saved) ' +
    'VALUES (?, ?, dateof(now()))',
    [userId,
     {value: postId, hint: cql.types.dataTypes.timeuuid}]
  )
  .fail(function (error) {
    console.trace("db error " + error);
  });
}

//saveUserSavedPostToDb('pkdebug', cql.types.timeuuid());
exports.saveUserSavedPostToDb = saveUserSavedPostToDb;

// TODO (kpan): add unit tests 