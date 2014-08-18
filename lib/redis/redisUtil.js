/**
 * Util class for Redis
 */

var redis = require("redis"),
  client = redis.createClient();

// if you'd like to select database 3, instead of 0 (default), call
// client.select(3, function() { /* ... */ });

client.on("error", function (err) {
  console.log("Error " + err);
});

//redis keys
var KEYS = {
  //Followed by, Set, followedBy:<user id> = a list of userIds who follows the user
  FOLLOWED_BY: "followedBy:%s",
  //Posts, Hset, hash key: postId
  POSTS: "posts",
  // Likes for a post, Set, post:likes:<post id> 
  POST_LIKES: "post:likes:%s",
  // Comments in a post, List, thread:<post id>
  THREAD: "thread:%s",
  // All comments, Hset, hash key: commentId
  COMMENTS: "comments",
  // Feeds of a user, List, feed:<user id> = a list of posts
  FEED: "feed:%s"
};


exports.client = client;
exports.redis = redis;
exports.KEYS = KEYS;
