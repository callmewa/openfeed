/**
 * This file contains logic for post.
 */

var Q = require('q');
var dbUtil = require('./db/dbUtil');
var cql = dbUtil.cql;
var dbClient = dbUtil.dbClient;
var dbPromise = require('./db/promise');
var moment = require("moment");

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
  },

  genSaveToDbPromise: function() {
    // TODO: implement it
    console.log("Save post to Cassandra db");
  },
  
  genSaveProductToDbPromise: function() {
    // Batch to write to both user_products table and post table.
    console.log("Save product to Cassandra db");
  },
  
  genSaveToRedisPromise: function() {
    // TODO: implement it
    console.log("Save to Redis");
  }
};

//saveUserSavedPostToDb('pkdebug', cql.types.timeuuid());
exports.saveUserSavedPostToDb = saveUserSavedPostToDb;
exports.UserPost = UserPost;

// TODO (kpan): add unit tests 