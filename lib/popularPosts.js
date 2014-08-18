/**
 * This file contains logic for popular posts. We keep 3 days' top-100 
 * popular posts per category in Redis. We also need to use a background 
 * schedule task to save top posts (max top 10 per day per category) into 
 * popular_post_bucket Cassandra table.
 */

var redisUtil = require("./redis/redisUtil");
var redis = redisUtil.redis;
var client = redisUtil.client;
var KEYS = redisUtil.KEYS;
var moment = require("moment");
var util = require('util');
var Q = require('q');
var dbUtil = require('./db/dbUtil');
var cql = dbUtil.cql;
var dbClient = dbUtil.dbClient;
var dbPromise = require('./db/promise');
var categories = require('./categories');

// Max posts per category
var MAX_POSTS_PER_CAT = 100;

// Save 10 top posts per day per category into Cassandra db. 
var COUNT_SAVE_PER_DAY_PER_CAT = 10;

// The map[category, score] maintains the min score of popular posts in 
// each category.
var minScoreTopPosts = {};

// Top posts should expired in "top_posts:%s" key after 3 days.
var topPostExpirationInSecond = 3 * 24 * 3600;

// The timestamp in seconds of last time we clean up expired top post in Redis
// "top_posts:%s" key. Since Redis doesn't has expiration for set members,
// we have to expire them by ourselves.
var lastTimeCleanUpExpiredTopPosts = 0;

// The interval to clean up expired top posts
var cleanExpiredIntervalInSeconds = 6 * 3600;

function genPostValueForCache(timestampInSeconds, postId) {
  return timestampInSeconds + ":" + postId;
}

/**
 * Clean up expired (more than 3 days old) from top post Redis key. 
 * @param key top post key "top_posts:%s", e.g. "top_posts:3m"
 */
function cleanUpExpiredTopPosts(key) {
  console.log("In cleanUpExpiredTopPosts");
  client.zrange(key, 0, -1, function (err, values) {
    if (err) {
      console.error("Error in cleanUpExpiredTopPosts, " + err);
    } else {
      var currentTimeInSeconds = Math.floor(moment() / 1000);
      var valuesToClear = [key];
      values.forEach(function (value) {
        var timestamp = value.split(":")[0];
        if (timestamp &&
            currentTimeInSeconds - timestamp > topPostExpirationInSecond) {
          // This value is stale
          valuesToClear.push(value);
        }
      });
      
      if (valuesToClear.length > 1) {
        console.log("ZREM, valuesToClear=" + valuesToClear);
        client.zrem(valuesToClear,
            function (err, response) {
              if (err) {
                console.error("Error in cleanUpExpiredTopPosts, " + err);
              }
        });
      }
    }
  });
}

/**
 * Update category popular posts in Redis if the post is popular enough
 * @param category string, the category of the post, e.g. 3m, 1y
 * @param likes int, count of likes on the post
 * @param comments int, count of comments on the post
 * @param timestampInSeconds int, timestamp in seconds (time info in postId)
 * @param postId string post id
 * @param cb callback
 */
function maybeUpdatePopularPost(category, likes, comments, timestampInSeconds, postId, cb) {
  var postScore = comments * 2 + likes;
  var minScore = minScoreTopPosts[category];
  var key = util.format(KEYS.TOP_POSTS, category);
  
  var interval = Math.floor(moment() / 1000) - lastTimeCleanUpExpiredTopPosts;
  
  if (interval > cleanExpiredIntervalInSeconds) {
    console.log("lastTimeCleanUpExpiredTopPosts=" +
        lastTimeCleanUpExpiredTopPosts +
        ", interval=" + interval);
    cleanUpExpiredTopPosts(key);
  }
  
  console.log("minScore=" + minScore + ", postScore=" + postScore);
  
  if (minScore && minScore >= postScore) {
    // The post is not popular enough to go to top posts cache.
    return;
  }
  
  Q.ninvoke(client, 'ZADD', key, postScore,
      genPostValueForCache(timestampInSeconds, postId))
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

/**
 * Save top posts of a category key to Cassandra db. 
 * It saves top posts from 48 hours ago to 24 hours ago into Cassandra db. 
 * Each time, it only saves the top 10 posts for each category.
 * @param key Redis key, e.g. 'top_posts:3m'
 */
function saveTopPostsToDbByKey(key) {
	console.log("In saveTopPostsToDbByKey for " + key);
	var nowInSeconds = Math.floor(moment());
	var startTimeInSeconds = nowInSeconds - 48 * 3600;
	var endTimeInSeconds = nowInSeconds - 24 * 3600;
	
	var valuesToSave = [];
  Q.ninvoke(client, 'ZREVRANGE', key, 0, -1)
    .then(function (values) {
      console.log("Results of ZREVRANGE, key=" + key + ', values=' + values);
      values.forEach(function (value) {
        if (valuesToSave.length === COUNT_SAVE_PER_DAY_PER_CAT) {
          return valuesToSave;
        }
        var timestamp = value.split(":")[0];
        var postId = value.split(":")[1];
        if (postId &&
            timestamp >= startTimeInSeconds &&
            timestamp <= endTimeInSeconds) {
          valuesToSave.push({timestamp: timestamp, postId: postId});
        }
      });
      return valuesToSave;
	})
	.then(function (valuesToSave) {
      if (valuesToSave.length === 0) {
        return;
      }
      var category = key.split(":")[1];
      var batchParams = [];
      valuesToSave.forEach(function (value) {
        var timestampInMs = value.timestamp * 1000;
        var yymm = moment(timestampInMs).format('YYMM');
        batchParams.push([category + ':' + yymm,
          {value: value.postId, hint: cql.types.dataTypes.timeuuid}]);
      });
      return dbPromise.genBatchQueryPromise(
        'INSERT INTO popular_post_bucket ' +
          '(post_category_date, post_id) ' +
        'VALUES (?, ?)',
        batchParams);
    })
	.then(
      function (result) {
        console.log("saveTopPostsToDbByKey succeeded");
      },
      function (error) {
        console.trace("Error for saveTopPostsToDbByKey " + error);
    });
}

/**
 * Save top posts to Cassandra db. This function should be called by a 
 * background task every day. Each time, it saves top posts from 48 hours
 * ago to 24 hours ago into Cassandra db. Each time, it only saves
 * the top 10 posts for each category.
 */
function saveTopPostsToDb() {
	console.log("In saveTopPostsToDb");
	
	categories.getPostCategires().forEach(function(category) {
    saveTopPostsToDbByKey(util.format(KEYS.TOP_POSTS, category));
	});
}

//saveTopPostsToDb();
//maybeUpdatePopularPost("1m", 6, 2, 1408123996, cql.types.timeuuid());
exports.maybeUpdatePopularPost = maybeUpdatePopularPost;
// TODO (kpan): add unit tests .