/**
 * Created by wa on 8/25/14.
 */

var assert = require("assert");
var should = require("should");
var utils = require("../lib/utils");
var FeedService = require("../lib/feedService"),
  service = new FeedService(),
  redisFeed = require("../lib/redisDelegate"),
  Events = FeedService.Events;


describe('FeedTest', function() {
  before(function(){
    service.on(Events.followUser, function(data){
      console.log(data);
    });
    service.addDelegate(redisFeed);
    redisFeed.client.flushdb();

  });

  describe('Follow user', function() {
    it('should add and get followers without error', function(done) {
      service.followUser('user1', 'user2');
      done();
    });
  });
});

describe('redisFeedTest', function(){
  it('drop current database', function(){
    redisFeed.client.flushdb();
  });

  it('should add and get followers without error', function(done){
    redisFeed.followUser({userId: 'user1', followerId:'user2'});
    redisFeed.followUser({userId: 'user1', followerId:'user3'});
    redisFeed.getFollowers('user1', function(err, follows){
      assert(follows.indexOf('user2')!=-1 && follows.indexOf('user3')!=-1, 'missing follower(s)');
    });
    done();
  });


  it('should add and get the post without error', function(done){
	var postId = utils.genId();
    redisFeed.addPost(
    		FeedService.UserPost.createPost(postId, 'user1', 'text', 'blah blah blah'),
    		function(err, result) {
    			redisFeed.getPost(postId, function(err, post){
    				JSON.parse(post).userId.should.equal('user1');
    				//assert.equal(JSON.parse(post).userId, 'user1');
    			});
    		});
    done();
  });

  it('should like get likes post without error', function(done){
    redisFeed.likePost({postId: 'post1',  userId: 'user2'});
    redisFeed.likePost({postId: 'post1',  userId: 'user3'});
    redisFeed.getPostLikes('post1',function(err, result){
      redisFeed.redis.print(err, JSON.stringify(result));
      assert(result.length === 2);
      result.should.containEql('user2');
      result.should.containEql('user3');
      done();
    });
  });


  it('should publish a post to feed without error', function(done){
    redisFeed.publishPostToFeeds({postId: 'post1',  userId: 'user1'}, function(err, result){
      redisFeed.redis.print(err, JSON.stringify(result));
      redisFeed.getFeed({userId: 'user2'}, function(err, feeds){
    	  assert(feeds[0].postId === 'post1');
      });
      redisFeed.getFeedLastInsertTime('user2', function(err, lastInsertTime){
    	  console.log("publishPostToFeeds, user2 lastInsertTime=" + lastInsertTime);
    	  assert(lastInsertTime > 0);
      });
      redisFeed.getFeed({userId: 'user3', largestInsertTimeAtClient: 999}, function(err, feeds){
        assert(feeds[0].postId === 'post1');
      });
      redisFeed.getFeedLastInsertTime('user3', function(err, lastInsertTime){
    	  console.log("publishPostToFeeds, user3 lastInsertTime=" + lastInsertTime);
    	  assert(lastInsertTime > 0);
      });
      done();
    });
  });

  it('should publish a comment to post without error', function(done){
    redisFeed.addComment(FeedService.Comment.createComment('post1', 'comment1', 'user1', 'this is a comment 1'));
    redisFeed.addComment(FeedService.Comment.createComment('post1', 'comment2', 'user1', 'this is a comment 2'));

    redisFeed.getThread({postId: 'post1', timeMsCreatedSince: 0},  function(err, result){
      redisFeed.redis.print(err, JSON.stringify(result));
      assert(result.length === 2);
      done();
    });
  });

});
