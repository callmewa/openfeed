/**
 * Created by wa on 8/25/14.
 */
/**
 * Created by zwang on 7/30/14.
 */


var moment = require("moment");
var util = require('util');
var Q = require('q');
var EventEmitter = require("events").EventEmitter;


function FeedService(){
  EventEmitter.call(this);
}

var Events = {
  followUser: "followUser",
  getFollowers: "getFollowers"
};

util.inherits(FeedService, EventEmitter);
FeedService.Events = Events;

module.exports = FeedService;

// TODO: remove dbClient example
// dbClient.execute('SELECT user_id, fname, lname FROM users WHERE user_id=?', [1745],
//   function(err, result) {
//     if (err) console.log('execute failed: ' + err);
//     else console.log('got user profile with name ' + result.rows[0].fname);
//   }
// );

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

//redis keys
//*FollowedBy = a list of userIds who follows the user
//*User = an individual
//*Thread = a list comments attached to a post
//*Feed = a list of posts
var KEYS = {
  FOLLOWED_BY: "followedBy:%s",
  POSTS: "posts",
  POST_LIKES: "post:likes:%s",
  THREAD: "thread:%s",
  COMMENTS: "comments",
  FEED: "feed:%s"
};

/**
 * follows a user given the followerId
 * RedisKey = followedBy:{userId}
 * use redis set
 * @param userId
 * @param followerId
 * @param cb
 */
//function followUser(userId, followerId, cb){
//  if(cb === undefined) cb = redis.print;
//  client.sadd(util.format(KEYS.FOLLOWED_BY, userId), followerId, cb);
//}
//
//function getFollowers(userId, cb){
//  if(cb === undefined) cb = redis.print;
//  client.smembers(util.format(KEYS.FOLLOWED_BY, userId), cb);
//}

/**
 * Emits 'followUser' with data ({userId: , followId: })
 * @param userId
 * @param followId
 * @param cb
 */
FeedService.prototype.followUser = function (userId, followId, cb) {
  this.emit('followUser', {userId: userId, followerId: followId}, cb)
};

/**
 * Emits 'getFollowers' event with usersId, cb
 * @param userId
 * @param cb
 */
FeedService.prototype.getFollowers = function(userId, cb) {
  this.emit('getFollowers', userId, cb);
};

///**
// * add a post to a post pool
// * RedisKey = 'posts' ; hashKey = {postId}
// * @param post
// * @param cb
// */
//function addPost(post, cb){
//  if(cb === undefined) cb = redis.print;
//  client.hset(KEYS.POSTS, post.postId, JSON.stringify(post), cb);
//}
//
//function getPost(postId, cb){
//  if(cb === undefined) cb = redis.print;
//  client.hget(KEYS.POSTS, postId, cb);
//}
//
//
//function likePost(postId, userId, cb){
//  if(cb === undefined) cb = redis.print;
//  client.sadd(util.format(KEYS.POST_LIKES, postId), userId, cb);
//}
//
//
//function getPostLikes(postId, cb){
//  if(cb === undefined) cb = redis.print;
//  client.smembers(util.format(KEYS.POST_LIKES, postId), cb);
//}
//
//
///**
// * add a comment to a thread list as well as comment hash
// * Thread list: RedisKey = "thread:{postId}"
// * Comments Hash: RedisKey = "comments"; hashKey = {commentId}
// * @param comment
// * @param cb
// */
//function addComment( comment, cb){
//  if(cb === undefined) cb = redis.print;
//  client.rpush(util.format(KEYS.THREAD, comment.postId), comment.commentId);
//  client.hset(KEYS.COMMENTS, comment.commentId, JSON.stringify(comment), cb);
//}
//
//function getThread(postId, cb){
//  Q.ninvoke(client, 'lrange', util.format(KEYS.THREAD, postId), 0, -1 )
//    .then(function(comments){
//      return Q.ninvoke(client, 'hmget', KEYS.COMMENTS, comments);
//    })
//    .done(function(results){
//      cb(null, results);
//    });
//}
//
///**
// * public post to various feeds (list)
// * RedisKey = 'feed:%s'
// * @param postId
// * @param userId
// * @param cb
// */
//function publishPostToFeeds(postId, userId, cb){
//  if(cb === undefined) cb = redis.print;
//
//  // this is an OK example of using Q library
//  // what's missing are all of the error cases which will be added later as needed
//
//  Q.nfcall(getFollowers, userId )
//    .then(function(followers){
//      var promises = followers.map(function(followerId){
//        console.log("created promise for " + postId + " to " + followerId );
//        return Q.ninvoke(client, 'rpush', util.format(KEYS.FEED, followerId), postId);
//      });
//      return Q.allSettled(promises);
//    })
//    .done(function(results){
//      cb(null, results);
//    })
//}
//
///**
// * get the user feed
// * @param userId
// * @param cb
// */
//function getFeed(userId, cb){
//  if(cb === undefined) cb = redis.print;
//  client.lrange(util.format(KEYS.FEED, userId), 0, -1, cb);
//}
//
//exports.UserPost = UserPost;
//exports.Comment = Comment;
//exports.followUser = followUser;
//exports.getFollowers = getFollowers;
//exports.addPost = addPost;
//exports.getPost = getPost;
//exports.likePost = likePost;
//exports.getPostLikes = getPostLikes;
//exports.addComment = addComment;
//exports.getThread = getThread;
//exports.publishPostToFeeds = publishPostToFeeds;
//exports.getFeed = getFeed;
//exports.client = client;
//exports.redis = redis;
