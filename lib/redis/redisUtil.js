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
  FEED: "feed:%s",
  // Points of a user, KEY, points:<user id>
  USER_POINTS: "points:%s",
  // Sorted set for top posts of a category, top_posts:3m
  //The value in the sorted set has the format of 
  //<timestamp in seconds>:<post id>, in which timestamp is timestamp info 
  //of the post id (timeUUID). The score is likes + comments * 2.
  TOP_POSTS: "topPosts:%s"
};

/**
 * Check whether Redis is available
 * @param cb
 */
function checkAvailable(cb) {
  client.ping(function (err, reply) {
    if (err) {
      console.error("Redis is not available, " + err);
    }
    if (cb) {
      cb(err);
    }
  });
}

exports.client = client;
exports.redis = redis;
exports.KEYS = KEYS;
exports.checkAvailable = checkAvailable;