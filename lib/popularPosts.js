/**
 * This file contains logic for popular posts. We keep 3 days' top-100 
 * popular posts per category in Redis. We also need to use a background 
 * schedule task to save top posts (max top 10 per day per category) into 
 * popular_post_bucket Cassandra table.
 */

var redis = require("redis"),
  client = redis.createClient();
var moment = require("moment");
var util = require('util');
var Q = require('q');
var cql = require('node-cassandra-cql'),
  dbClient = new cql.Client({hosts: ['localhost'], keyspace: 'myks'});

// if you'd like to select database 3, instead of 0 (default), call
// client.select(3, function() { /* ... */ });
client.on("error", function (err) {
  console.error("Redis error " + err);
});

//redis key for sorted set for top posts of a category, top_posts:3m
// The value in the sorted set has the format of 
// YYMM|<post id>, in which YYMM is date (year and month) info 
// of the post id (timeUUID)
var TOP_POSTS = "top_posts:%s";

// Max posts per category
var MAX_POSTS_PER_CAT = 100;

// The map[category, score] maintains the min score of popular posts in 
// each category.
var minScoreTopPosts = {};

function genPostValueForCache(yymm, postId) {
  return yymm + "|" + postId;
}

/**
 * Update category popular posts if the post is popular enough
 * @param category string, the category of the post, e.g. 3m, 1y
 * @param likes int, count of likes on the post
 * @param comments int, count of comments on the post
 * @param yymm string, 1408
 * @param postId string post id
 * @param cb callback
 */
function maybeUpdatePopularPost(category, likes, comments, yymm, postId, cb) {
  var postScore = comments * 2 + likes;
  var minScore = minScoreTopPosts[category];
  
  console.log("minScore=" + minScore + ", postScore=" + postScore);
  
  if (minScore && minScore >= postScore) {
    // The post is not popular enough to go to top posts cache.
    return;
  }
  
  var key = util.format(TOP_POSTS, category);
  Q.ninvoke(client, 'ZADD', key, postScore, genPostValueForCache(yymm, postId))
  .then(function(result) {
    console.log("Result of ZADD, " + result);
    if (result > 0) {
      // A new popular post is inserted, then we get the count of 
      // posts for this key
      return Q.ninvoke(client, 'ZCARD', key);
    } else {
      // It is the case that an existing popular post gets a new score.
      return 0;
    }
  })
  .then(function(count) {
    console.log("Result of ZCARD, " + count);
    if (count > MAX_POSTS_PER_CAT) {
      // Keep max MAX_POSTS_PER_CAT posts. 
      return Q.ninvoke(client, 'ZREMRANGEBYRANK', key, 0,
          count - MAX_POSTS_PER_CAT - 1);
    }
  })
  .then(function (result) {
    console.log("Result of ZREMRANGEBYRANK, " + result);
    // Update the min score
    return Q.ninvoke(client, 'ZRANGE', key, 0, 0, 'WITHSCORES');
  })
  .then(function (minPost) {
    console.log("minPost=" + minPost);
    if (minPost) {
      console.log("category=" + category + ", minPost[1]=" + minPost[1]);
      minScoreTopPosts[category] = minPost[1];
    }
  })
  .then(
    function (result) {
      console.log("maybeUpdatePopularPost succeeded");
      cb();
    },
    function (error) {
      console.error("Redis error for maybeUpdatePopularPost" + error);
  });
}

maybeUpdatePopularPost("3m", 5, 2, '1408', 'aaaaa');
// TODO (kpan): add unit tests .