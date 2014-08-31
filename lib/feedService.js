/**
 * Created by wa on 8/25/14.
 */
/**
 * Created by zwang on 7/30/14.
 */


var moment = require("moment");
var util = require('util');
var EventEmitter = require("events").EventEmitter;


function FeedService(){
  EventEmitter.call(this);
}

var Events = [
  "followUser",
  "getFollowers",
  "addPost",
  "getPost",
  "likePost",
  "getPostLikes",
  "addComment",
  "getThread",
  "publishPostToFeeds",
  "getFeed"
]
  .reduce(function(o, k) {
    o[k] = k;
    return o;
  }, {});

util.inherits(FeedService, EventEmitter);
FeedService.Events = Events;

module.exports = FeedService;


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
  }
};

FeedService.UserPost = UserPost;

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

FeedService.Comment = Comment;


/**
 * Emits 'followUser' with data ({userId: , followId: })
 * @param userId
 * @param followId
 * @param cb
 */
FeedService.prototype.followUser = function (userId, followId, cb) {
  this.emit(Events.followUser, {userId: userId, followerId: followId}, cb)
};

/**
 * Emits 'getFollowers' event with usersId, cb
 * @param userId
 * @param cb
 */
FeedService.prototype.getFollowers = function(userId, cb) {
  this.emit(Events.getFollowers, userId, cb);
};

/**
* add a post to a post pool
* @param post
* @param cb
*/
FeedService.prototype.addPost = function(post, cb) {
  this.emit(Events.addPost, post, cb);
};

FeedService.prototype.getPost = function(postId, cb) {
  this.emit(Events.getPost, postId, cb);
};


FeedService.prototype.likePost = function(postId, userId, cb) {
  this.emit(Events.likePost, {postId: postId, userId: userId}, cb);
};


FeedService.prototype.getPostLikes = function(postId, cb) {
  this.emit(Events.getPostLikes, postId, cb);
};


/**
* add a comment to a thread list as well as comment hash
* @param comment
* @param cb
*/
FeedService.prototype.addComment = function( comment, cb) {
  this.emit(Events.addComment, comment, cb);
};


FeedService.prototype.getThread = function(postId, cb){
  this.emit(Events.getThread, postId, cb);
};

/**
* public post to various feeds (list)
* @param postId
* @param userId
* @param cb
*/
FeedService.prototype.publishPostToFeeds = function(postId, userId, cb){
  this.emit(Events.publishPostToFeeds, {postId: postId, userId: userId}, cb);
};

/**
* get the user feed
* @param userId
* @param cb
*/
FeedService.prototype.getFeed = function(userId, cb){
  this.emit(Events.getFeed, userId, cb);
};

/**
 * add a delegate to the service
 * redis, cassandra etc
 * @param delegate
 */
FeedService.prototype.addDelegate = function(delegate){
  Object.keys(Events).forEach(function(event){
    this.on(event, delegate[event]);
  }.bind(this));
};
