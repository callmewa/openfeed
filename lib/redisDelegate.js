/**
 * Created by wa on 8/31/14.
 */

var redis = require("redis"),
  client = redis.createClient();
var util = require('util');
var Q = require('q');
var moment = require("moment");

// The default number of posts to fetch for feed loading
var defaultMaxToFetch = 20;
var defaultMaxCommentsToFetch = 50;

// if you'd like to select database 3, instead of 0 (default), call
// client.select(3, function() { /* ... */ });

client.on("error", function (err) {
  console.log("Error " + err);
});

//redis keys
//*FollowedBy = a list of userIds who follows the user
//*User = an individual
//*POST_LIKES = a sorted set of likers for a post order by time of like
//*Thread = a sorted set of comments attached to a post order by create time of the comment
//*Feed = a sorted set of posts order by insert time for a user
//*TOP_IN_FEED = a hashmap<user id, largest timestamp of the feed> to record
// the largest inserted-time of the feed for a user.
var KEYS = {
  FOLLOWED_BY: "followedBy:%s",
  POSTS: "posts",
  POST_LIKES: "post:likes:%s",
  THREAD: "thread:%s",
  COMMENTS: "comments",
  FEED: "feed:%s",
  TOP_IN_FEED: "topInFeed",
  // Sorted set for the posts of a category, e.g. categoryPosts:3m.
  // The set is sorted by creat-time or comment-time of the post.
  // The value in the sorted set has the format of <post id>.
  CATEGORY_FEED: "categoryFeed:%s"
};

/**
 * follows a user given the followerId
 * RedisKey = followedBy:{userId}
 * use redis set
 * @param userId
 * @param followerId
 * @param cb
 */
function followUser(userId, followerId, cb){
  if(cb === undefined) cb = redis.print;
  client.sadd(util.format(KEYS.FOLLOWED_BY, userId), followerId, cb);
}

function getFollowers(userId, cb){
  if(cb === undefined) cb = redis.print;
  client.smembers(util.format(KEYS.FOLLOWED_BY, userId), cb);
}

/**
 * Update the largest insert time for a feed, then insert the post id 
 * into the feed.
 * @param followerId
 * @param postId
 * @returns a promise
 */
function addToFeed(followerId, postId) {
  console.log("addToFeed, followerId=" + followerId + ", postId=" + postId);
  var timeInserted = moment().valueOf();
  // First record the largest insert-time for the feed
  return Q.ninvoke(client, 'HSET', KEYS.TOP_IN_FEED, followerId, timeInserted)
    .then(function() {
	  // Add the post into the feed
	  return Q.ninvoke(client, 'ZADD', util.format(KEYS.FEED, followerId), timeInserted, postId);
    });
}

/**
 * Get the last insert time of a user's feed
 * @param userId
 * @param cb
 * @returns promise
 */
function getFeedLastInsertTime(userId, cb) {
  if(cb === undefined) cb = redis.print;
  return Q.ninvoke(client, 'hget', KEYS.TOP_IN_FEED, userId);
}

/**
 * add a post to a post pool
 * RedisKey = 'posts' ; hashKey = {postId}
 * @param post
 * @param cb
 */
function addPost(post, cb){
  if(cb === undefined) cb = redis.print;
  var postJson = JSON.stringify(post);
  console.log("addPost, " + postJson);
  
  // First, save the post to redis
  Q.ninvoke(client, 'hset', KEYS.POSTS, post.postId, postJson)
  .then (function () {
	  // Save the post to the author's feed
	  return addToFeed(post.userId, post.postId);
  }).then(function (result) {
      // success
      console.log("addPost succeeded");
      cb(null, result);
      
      // Fan-out to followers' feed in redis. Fire-and-forget.
      publishPostToFeeds(post.postId, post.userId);
      
      // Publish the post to category feed. Fire-and-forget
      publishPostToCategoryFeed(post.postId, post.category, post.timeMsCreated);
  	}, function(err) {
  		// Failed
  	  console.trace("addPost failed, " + err);
	    cb(err);
  });
}

function getPost(postId, cb){
  if(cb === undefined) cb = redis.print;
  client.hget(KEYS.POSTS, postId, cb);
}

/**
 * Increment the like count of a post. Fire-and-forget
 * @param postId
 */
function changeLikeCount(postId, isLiked) {
  console.log("In changeLikeCount for " + postId + ", isLiked=" + isLiked);
  Q.ninvoke(client, 'hget', KEYS.POSTS, postId
  ).then(function(post) {
    var postJson = JSON.parse(post);
    if (isLiked) {
      postJson.likes = 1 + postJson.likes;
    } else {
      postJson.likes = postJson.likes - 1;
    }
    // put it back
    return Q.ninvoke(client, 'hset', KEYS.POSTS, postJson.postId, JSON.stringify(postJson));
  }).fail(function (error) {
    console.trace('changeLikeCount failed, error=' + error);
  });
}

// Like or unlike a post
function likePost(postLike, cb){
  if(cb === undefined) cb = redis.print;
  console.log("likePost, postLike=" + JSON.stringify(postLike));
  
  if (postLike.isLiked) {
    var likeTime = moment().valueOf();
    client.zadd(util.format(KEYS.POST_LIKES, postLike.postId), likeTime, postLike.likerUserId, cb);
  } else {
    client.zrem(util.format(KEYS.POST_LIKES, postLike.postId), postLike.likerUserId, cb);
  }
  // Change like count of the post. Fire and forget.
  changeLikeCount(postLike.postId, postLike.isLiked);
}

function getPostLikes(loadLikesParams, cb){
  if(cb === undefined) cb = redis.print;
  console.log("getPostLikes, loadLikesParams=" + JSON.stringify(loadLikesParams));
  var postId = loadLikesParams.postId;
  var isLoadMore = loadLikesParams.timeSince > 0;
  var maxToFetch = loadLikesParams.maxToFetch;
  var likerIdToScore = {};
  
  Q.ninvoke(
      client, 
      'zrevrangebyscore', 
      util.format(KEYS.POST_LIKES, postId),
      isLoadMore ? loadLikesParams.timeSince : '+inf', 
      '-inf',
      'WITHSCORES',
      'LIMIT',
      0,
      maxToFetch
  ).then(function(likerIdsWithScore) {
    var lastLikerId;
    var i = 0;
    var len = likerIdsWithScore.length;
    var promises = [];
    
    for (; i < len ; i++){
      var likerIdOrScore = likerIdsWithScore[i];
      
      if (i % 2 === 0) {
        // likerIdOrScore is likerId
        lastLikerId = likerIdOrScore;
        
        //var getLikerPromise = Q.ninvoke(client, 'hget', KEYS.POSTS, postIdOrScore);
        var getLikerPromise = Q(likerIdOrScore);
        promises.push(getLikerPromise);
      } else {
        // likerIdOrScore is score (like time)
        likerIdToScore[lastLikerId] = likerIdOrScore;
      }
    }
    
    // Get the all likers for this loading 
    return Q.all(promises);
  }).then(function (likers) {
    // Success
    var likersToReturn = [];
    likers.forEach(function(liker) {
      var resultLiker = {};
      resultLiker.likerUserId = liker;
      resultLiker.timeMsLike = likerIdToScore[liker];
      
      likersToReturn.push(resultLiker);
    });
    
    console.log("getPostLikes, likersToReturn=" + JSON.stringify(likersToReturn));
    cb(null, likersToReturn);
  }, function(err) {
    // failure
    console.trace("Error in getPostLikes, " + err);
    cb(err);
  });
}

/**
 * Increment the comment count of a post. Fire-and-forget
 * @param postId
 */
function incrementCommentCount(postId) {
  console.log("In incrementCommentCount for " + postId);
  Q.ninvoke(client, 'hget', KEYS.POSTS, postId
  ).then(function(post) {
    var postJson = JSON.parse(post);
    postJson.comments = 1 + postJson.comments;
    // put it back
    return Q.ninvoke(client, 'hset', KEYS.POSTS, postJson.postId, JSON.stringify(postJson));
  }).fail(function (error) {
    console.trace('incrementCommentCount failed, error=' + error);
  });
}

/**
 * add a comment to a thread sorted set as well as comment hash
 * Thread list: RedisKey = "thread:{postId}", score: create time of comment
 * Comments Hash: RedisKey = "comments"; hashKey = {commentId}
 * @param comment
 * @param cb
 */
function addComment(comment, cb){
  if(cb === undefined) cb = redis.print;
  console.log("addComment, comment=" + JSON.stringify(comment));

  client.zadd(
      util.format(KEYS.THREAD, comment.postId), 
      comment.timeMsCreated, 
      comment.commentId);
  client.hset(KEYS.COMMENTS, comment.commentId, JSON.stringify(comment), cb);
  
  // increment comment count of the post. Fire and forget.
  incrementCommentCount(comment.postId);
}

function getThread(loadCommentsParams, cb){
  if(cb === undefined) cb = redis.print;
  
  console.log("getThread, loadCommentsParams=" + JSON.stringify(loadCommentsParams));
  
  var maxToFetch = loadCommentsParams.maxToFetch;
  if (!maxToFetch) {
    maxToFetch = defaultMaxCommentsToFetch;
  }

  var isLoadMore = loadCommentsParams.timeSince > 0;
  
  Q.ninvoke(
      client, 
      'zrevrangebyscore', 
      util.format(KEYS.THREAD, loadCommentsParams.postId),
      isLoadMore ? loadCommentsParams.timeSince : '+inf', 
      '-inf',
      'LIMIT',
      0,
      maxToFetch
  ).then(function(comments){
    console.log("getThread, comments=" + comments);
    if (!comments || comments.length === 0) {
      return Q([]);
    } else {
      return Q.ninvoke(client, 'hmget', KEYS.COMMENTS, comments);
    }
  }).done(function(results){
    var jsonResults = results.map(JSON.parse);
    console.log("getThread, jsonResults=" + JSON.stringify(jsonResults));
    cb(null, jsonResults);
  });
}

/**
 * public post to followers' feeds
 * RedisKey = 'feed:%s'
 * @param postId
 * @param userId
 * @param cb
 */
function publishPostToFeeds(postId, userId, cb){
  if(cb === undefined) cb = redis.print;

  Q.nfcall(getFollowers, userId )
    .then(function(followers){
      var promises = followers.map(function(followerId){
        console.log("created promise for " + postId + " to " + followerId );
        return addToFeed(followerId, postId);
      });
      return Q.allSettled(promises);
    })
    .then(function(results){
      cb(null, results);
    }, function (err) {
      console.trace("Error in publishPostToFeeds, " + err);
    });
}

/**
 * public post to category feed
 * @param postId
 * @param category
 * @param cb
 */
function publishPostToCategoryFeed(postId, category, timestamp, cb){
  if(cb === undefined) cb = redis.print;

  var key = util.format(KEYS.CATEGORY_FEED, category);
  console.log("publishPostToCategoryFeed for key=" +
      key + ", postId=" + postId);
  // Update category-based Redis sorted set for posts. Fire-and-forget.
  Q.ninvoke(client, 'ZADD', key, timestamp, postId
  ).then(function(results){
    cb(null, results);
  }, function (err) {
    console.trace("Error in publishPostToCategoryFeed, " + err);
  });
}

/**
 * Return a promise that get post object for the postId with whether
 * the feed user like this post or not.
 * @param postId post id
 * @param userId feed user
 */
function getPostWithUserLike(postId, userId) {
  return Q.all([
     Q.ninvoke(client, 'hget', KEYS.POSTS, postId),
     Q.ninvoke(client, 'zscore', util.format(KEYS.POST_LIKES, postId), userId)]
  ).then(function(results){
    var postJsonStr = results[0];
    var likeTime = results[1];
    var jsonPost = JSON.parse(postJsonStr);
    if (likeTime) {
      jsonPost.isLiked = true;
    } else {
      jsonPost.isLiked = false;
    }
    
    return Q(jsonPost);
  });
}

/**
 * Load user feed
 * @param userId
 * @param cb
 */
function getFeed(loadFeedParams, cb){
  if(cb === undefined) cb = redis.print;

  console.log("getFeed, loadFeedParams=" + JSON.stringify(loadFeedParams));
  
  var userId = loadFeedParams.userId;
  if (!userId) {
	  cb(new Error("No userId found in the request to load feed!"));
	  return;
  }
  
  var maxToFetch = loadFeedParams.maxToFetch;
  if (!maxToFetch) {
	  maxToFetch = defaultMaxToFetch;
  }
  
  // In the client, the largest insert time in the feed of the user.
  var largestInsertTimeAtClient = loadFeedParams.largestInsertTimeAtClient;
  var postIdToScore = {};
  // If isReturnAllPostFailes is false, we only need to comment count and like
  // count for post that's not edited or deleted or marked as not-normal.
  var isReturnAllPostFields = true;
  
  var getLastInsertTimePromise;
  if (largestInsertTimeAtClient) {
    getLastInsertTimePromise = getFeedLastInsertTime(userId);
  } else {
    // Client doesn't have last insert time for feed, then we should
    // get all post fields.
    getLastInsertTimePromise = Q(undefined);
  }

  var isLoadMore = loadFeedParams.timeSince > 0;
  
  // First, check whether we need to return all fields of posts
  getLastInsertTimePromise
  .then(function(feedLastInsertTime){
    if (largestInsertTimeAtClient &&
        feedLastInsertTime === largestInsertTimeAtClient) {
      isReturnAllPostFields = false;
    }
    // Then, Load feed post Ids
  	return Q.ninvoke(
      client, 
      'zrevrangebyscore', 
      util.format(KEYS.FEED, userId),
      isLoadMore ? loadFeedParams.timeSince : '+inf', 
      '-inf',
      'WITHSCORES',
      'LIMIT',
      0,
      maxToFetch);
  }).then(function(postIdsWithScore) {
    var lastPostId;
    var i = 0;
    var len = postIdsWithScore.length;
    var promises = [];
    
    for (; i < len ; i++){
      var postIdOrScore = postIdsWithScore[i];
      
      if (i % 2 === 0) {
        // postIdOrScore is postId
        lastPostId = postIdOrScore;
        
        var getPostPromise = getPostWithUserLike(postIdOrScore, userId);
        promises.push(getPostPromise);
      } else {
        // postIdOrScore is score (insert time)
        postIdToScore[lastPostId] = postIdOrScore;
      }
    }
    
    // Get the all posts for this feed loading 
    return Q.all(promises);
  }) .then(function (posts) {
    // Success
    var feedPostsToReturn = [];
    posts.forEach(function(post) {
      var resultPost = {};
      if (!isReturnAllPostFields && false && // TODO: hold off returnPartialFields feature by now.
          !post.timeMsEdited && 
          post.postStatus === "Normal") { // TODO (kpan) define constants file.
        // The post was not edited, and the status was not changed, 
        // we only need to return partial data.
        resultPost.postId = post.postId;
        resultPost.likes = post.likes;
        resultPost.comments = post.comments;
      } else {
        resultPost = post;
        resultPost.timeMsInserted = postIdToScore[post.postId];
      }
      
      feedPostsToReturn.push(resultPost);
    });
    
    console.log("getFeed, feedPostsToReturn=" + JSON.stringify(feedPostsToReturn));
    cb(null, feedPostsToReturn);
  }, function(err) {
    // failure
    console.trace("Error in getFeed, " + err);
    cb(err);
  });
}

/**
 * Load category feed
 * @param cb
 */
function getCategoryFeed(loadCategoryFeedParams, cb){
  if(cb === undefined) cb = redis.print;

  console.log("getCategoryFeed, loadFeedParams=" + 
      JSON.stringify(loadCategoryFeedParams));
  
  var category = loadCategoryFeedParams.category;
  var userId = loadCategoryFeedParams.userId;
  
  var maxToFetch = loadCategoryFeedParams.maxToFetch;
  if (!maxToFetch) {
    maxToFetch = defaultMaxToFetch;
  }
  
  var postIdToScore = {};

  var offset = loadCategoryFeedParams.offset;

  // First, Load category feed post Ids
  Q.ninvoke(
      client, 
      'zrevrangebyscore', 
      util.format(KEYS.CATEGORY_FEED, category),
      '+inf', 
      '-inf',
      'WITHSCORES',
      'LIMIT',
      offset,
      maxToFetch
  )
  .then(function(postIdsWithScore) {
    var lastPostId;
    var i = 0;
    var len = postIdsWithScore.length;
    var promises = [];
    
    for (; i < len ; i++){
      var postIdOrScore = postIdsWithScore[i];
      
      if (i % 2 === 0) {
        // postIdOrScore is postId
        lastPostId = postIdOrScore;
        
        var getPostPromise = getPostWithUserLike(postIdOrScore, userId);
        promises.push(getPostPromise);
      } else {
        // postIdOrScore is score (timestamp)
        postIdToScore[lastPostId] = postIdOrScore;
      }
    }
    
    // Get the all posts for this feed loading 
    return Q.all(promises);
  }) .then(function (posts) {
    // Success
    var feedPostsToReturn = [];
    posts.forEach(function(post) {
      var resultPost = {};
      resultPost = post;
      resultPost.timeMsChangeToSurface = postIdToScore[post.postId];
      
      feedPostsToReturn.push(resultPost);
    });
    
    console.log("getCategoryFeed, feedPostsToReturn=" + JSON.stringify(feedPostsToReturn));
    cb(null, feedPostsToReturn);
  }, function(err) {
    // failure
    console.trace("Error in getCategoryFeed, " + err);
    cb(err);
  });
}

exports.followUser = function(){
  return followUser(arguments[0].userId, arguments[0].followerId, arguments[1]);
};
exports.getFollowers = getFollowers;
exports.addPost = addPost;
exports.getPost = getPost;
exports.likePost = likePost;
exports.getPostLikes = getPostLikes;
exports.addComment = addComment;
exports.getThread = getThread;
exports.publishPostToFeeds = function(){
  return publishPostToFeeds(arguments[0].postId, arguments[0].userId, arguments[1]);
};
exports.publishPostToCategoryFeed = publishPostToCategoryFeed;
exports.getCategoryFeed = getCategoryFeed;
exports.getFeed = getFeed;
exports.getFeedLastInsertTime = getFeedLastInsertTime;
exports.client = client;
exports.redis = redis;
