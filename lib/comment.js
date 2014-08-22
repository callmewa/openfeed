/**
 * This file contains data for comment.
 */

var Q = require('q');
var dbUtil = require('./db/dbUtil');
var cql = dbUtil.cql;
var dbClient = dbUtil.dbClient;
var dbPromise = require('./db/promise');
var moment = require("moment");

var Comment = {
  postId: null,
  commentId: null,
  commenterUserId: null,
  message: null,
  pictureUrl: null,
  likes: null,
  isAnonymous: null,
  isAnswer: null,
  isAcceptedAnswer: null,
  answerPointsEarned: null,
  status: null,
  timeCreated: null,
  timeEdited: null,

  createComment: function(
      postId,
      commentId,
      commenterUserId,
      message,
      pictureUrl,
      likes,
      isAnonymous,
      isAnswer,
      isAcceptedAnswer,
      answerPointsEarned,
      status){
    var obj = Object.create(this);
    obj.postId = postId;
    obj.commentId = commentId;
    obj.commenterUserId = commenterUserId;
    obj.message = message;
    obj.pictureUrl = pictureUrl;
    obj.likes = likes;
    obj.isAnonymous = isAnonymous;
    obj.isAnswer = isAnswer;
    obj.isAcceptedAnswer = isAcceptedAnswer;
    obj.answerPointsEarned = answerPointsEarned;
    obj.status = status;
    obj.timeCreated = moment().valueOf();
    return obj;
  }
};

/**
 * 
 * @param postComment the comment to a post
 * @returns the promise that save the comment to db.
 */
function saveToDb(postComment) {
  console.log("In comment.saveToDb, " + JSON.stringify(postComment));
  var commentId = cql.types.timeuuid();
  return dbPromise.genQueryPromise(
      'INSERT INTO comment ' +
        '(post_id, comment_id, commenter_user_id, ' +
          'message, picture_url, likes, is_anonymous, ' +
          'is_answer, is_accepted_answer, answer_points_earned, status, ' +
          'time_created, time_edited) ' +
      'VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [{value: postComment.postId, hint: cql.types.dataTypes.timeuuid},
       {value: commentId, hint: cql.types.dataTypes.timeuuid},
       {value: postComment.commenterUserId, hint: cql.types.dataTypes.ascii},
       {value: postComment.message, hint: cql.types.dataTypes.text},
       {value: postComment.pictureUrl, hint: cql.types.dataTypes.varchar},
       {value: postComment.likes, hint: cql.types.dataTypes.int},
       {value: postComment.isAnonymous, hint: cql.types.dataTypes.boolean},
       {value: postComment.isAnswer, hint: cql.types.dataTypes.boolean},
       {value: postComment.isAcceptedAnswer, hint: cql.types.dataTypes.boolean},
       {value: postComment.answerPointsEarned, hint: cql.types.dataTypes.int},
       {value: postComment.status, hint: cql.types.dataTypes.ascii},
       {value: postComment.timeCreated, hint: cql.types.dataTypes.timestamp},
       {value: postComment.timeEdited, hint: cql.types.dataTypes.timestamp}]
    )
    .fail(function (error) {
      console.error("comment.saveToDb error " + error);
      throw error;
    });
}

//saveToDb(Comment.createComment(
//    '0952dbc0-295d-11e4-9a40-872535ebf9f7',
//    cql.types.timeuuid(),
//    'pkdebug',
//    'unit test',
//    null,
//    null,
//    false,
//    false,
//    null,
//    null,
//    null
//    ));
exports.Comment = Comment;
exports.saveToDb = saveToDb;

// TODO (kpan): add unit tests 