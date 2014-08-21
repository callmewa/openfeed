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
  date: null,
  postId: null,
  userId: null,
  postType: null,
  postCategory: null,
  forGender: null,
  message: null,
  pictureUrl: null,
  externalLinkUrl: null,
  externalLinkImageUrl: null,
  externalLinkSummary: null,
  productBarCode: null,
  publicity: null,
  isQuestion: null,
  isAnswered: null,
  questionPoints: null,
  isProduct: null,
  likes: null,
  comments: null,
  isAnonymous: null,
  status: null,
  timeCreated: null,
  timeEdited: null,
  timeCommented: null,
  timeLastupdated: null,

  /**
   * Default factory method
   * consider using IdGenerator for postId
   * @param postId
   * @param userId
   * @param postType
   * @param message
   */
  createPost: function(postId,
      userId,
      postType,
      postCategory,
      forGender,
      message,
      pictureUrl,
      externalLinkUrl,
      externalLinkImageUrl,
      externalLinkSummary,
      productBarCode,
      publicity,
      isQuestion,
      isAnswered,
      questionPoints,
      isProduct,
      likes,
      comments,
      isAnonymous,
      status) {
    var obj = Object.create(this);
    var nowTime = moment();
    var notTimeMs = nowTime.valueOf();
    obj.date = nowTime.format("YYYYMMDD");
    obj.postId = postId;
    obj.userId = userId;
    obj.postType = postType;
    obj.postCategory = postCategory;
    obj.forGender = forGender;
    obj.message = message;
    obj.pictureUrl = pictureUrl;
    obj.externalLinkUrl = externalLinkUrl;
    obj.externalLinkImageUrl = externalLinkImageUrl;
    obj.externalLinkSummary = externalLinkSummary;
    obj.productBarCode = productBarCode;
    obj.publicity = publicity;
    obj.isQuestion = isQuestion;
    obj.isAnswered = isAnswered;
    obj.questionPoints = questionPoints;
    obj.isProduct = isProduct;
    obj.likes = likes;
    obj.comments = comments;
    obj.isAnonymous = isAnonymous;
    obj.status = status;
    obj.timeCreated = notTimeMs;
    obj.timeLastupdated = notTimeMs;
    
    return obj;
  },
};

/**
 * @param userPost
 * @returns boolean whether the post is private
 */
function isPrivate(userPost) {
  return userPost.publicity === 'V';
}

/**
 * @param userPost the post to save
 * @returns the promise that save the post to db.
 */
function saveToDb(userPost) {
  console.log("In saveToDb, " + JSON.stringify(userPost));
  return dbPromise.genQueryPromise(
      'INSERT INTO post ' +
        '(date, post_id, user_id, post_type, post_category, for_gender, ' +
          'message, picture_url, external_link_url, external_link_image_url, ' +
          'external_link_summary, product_bar_code, publicity, is_question, ' +
          'is_answered, question_points, is_product, likes, ' +
          'comments, is_anonymous, status, time_created, time_lastupdated) ' +
      'VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [{value: userPost.date, hint: cql.types.dataTypes.varchar},
       {value: userPost.postId, hint: cql.types.dataTypes.timeuuid},
       {value: userPost.userId, hint: cql.types.dataTypes.ascii},
       {value: userPost.postType, hint: cql.types.dataTypes.ascii},
       {value: userPost.postCategory, hint: cql.types.dataTypes.ascii},
       {value: userPost.forGender, hint: cql.types.dataTypes.ascii},
       {value: userPost.message, hint: cql.types.dataTypes.text},
       {value: userPost.pictureUrl, hint: cql.types.dataTypes.varchar},
       {value: userPost.externalLinkUrl, hint: cql.types.dataTypes.varchar},
       {value: userPost.externalLinkImageUrl, hint: cql.types.dataTypes.varchar},
       {value: userPost.externalLinkSummary, hint: cql.types.dataTypes.varchar},
       {value: userPost.productBarCode, hint: cql.types.dataTypes.varchar},
       {value: userPost.publicity, hint: cql.types.dataTypes.ascii},
       {value: userPost.isQuestion, hint: cql.types.dataTypes.boolean},
       {value: userPost.isAnswered, hint: cql.types.dataTypes.boolean},
       {value: userPost.questionPoints, hint: cql.types.dataTypes.int},
       {value: userPost.isProduct, hint: cql.types.dataTypes.boolean},
       {value: userPost.likes, hint: cql.types.dataTypes.int},
       {value: userPost.comments, hint: cql.types.dataTypes.int},
       {value: userPost.isAnonymous, hint: cql.types.dataTypes.boolean},
       {value: userPost.status, hint: cql.types.dataTypes.ascii},
       {value: userPost.timeCreated, hint: cql.types.dataTypes.timestamp},
       {value: userPost.timeLastupdated, hint: cql.types.dataTypes.timestamp}]
    )
    .fail(function (error) {
      console.error("post.saveToDb error " + error);
      throw error;
    });
}

/**
 * Save product post into user_products table.
 * @param userProduct
 */
function saveToUserProducts(userProductPost) {
  console.log("In saveToProductList for userId=" + userProductPost.userId +
      ", productId=" + userProductPost.productId);
  var timestampMs = moment().valueOf();
  return dbPromise.genQueryPromise(
      'INSERT INTO user_products ' +
      '(post_id, user_id, post_category, for_gender, ' +
        'message, picture_url, external_link_url, external_link_image_url, ' +
        'external_link_summary, product_bar_code, publicity, time_inserted) ' +
    'VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
    [{value: userProductPost.postId, hint: cql.types.dataTypes.timeuuid},
     {value: userProductPost.userId, hint: cql.types.dataTypes.ascii},
     {value: userProductPost.postCategory, hint: cql.types.dataTypes.ascii},
     {value: userProductPost.forGender, hint: cql.types.dataTypes.ascii},
     {value: userProductPost.message, hint: cql.types.dataTypes.text},
     {value: userProductPost.pictureUrl, hint: cql.types.dataTypes.varchar},
     {value: userProductPost.externalLinkUrl, hint: cql.types.dataTypes.varchar},
     {value: userProductPost.externalLinkImageUrl, hint: cql.types.dataTypes.varchar},
     {value: userProductPost.externalLinkSummary, hint: cql.types.dataTypes.varchar},
     {value: userProductPost.productBarCode, hint: cql.types.dataTypes.varchar},
     {value: userProductPost.publicity, hint: cql.types.dataTypes.ascii},
     {value: timestampMs, hint: cql.types.dataTypes.timestamp}]
    )
    .fail(function (error) {
      console.error("post.saveToUserProducts error " + error);
      throw error;
    });
}

function genSaveProductToDbPromise(userPost) {
  // Batch to write to both user_products table and post table.
  console.log("Save product to Cassandra db");
}

function saveToRedis(userPost) {
  // TODO: implement it
  console.log("Save to Redis");
}

//saveToDb(UserPost.createPost(
//      cql.types.timeuuid(),
//      "pkdebug",
//      "R",
//      "3m",
//      null,
//      "It is a test",
//      null,
//      null,
//      null,
//      null,
//      null,
//      "P",
//      false,
//      null,
//      null,
//      false,
//      0,
//      0,
//      false,
//      null));
//saveUserSavedPostToDb('pkdebug', cql.types.timeuuid());
exports.saveUserSavedPostToDb = saveUserSavedPostToDb;
exports.UserPost = UserPost;
exports.saveToDb = saveToDb;
exports.isPrivate = isPrivate;
exports.saveToUserProducts = saveToUserProducts;

// TODO (kpan): add unit tests 