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
  postId:null,
  commentId:null,
  userId:null,
  message:null,
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
      userId,
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
    obj.userId = userId;
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

exports.Comment = Comment;

// TODO (kpan): add unit tests 