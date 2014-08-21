/**
 * Created by zwang on 7/30/14.
 */
//TODO: use should.js

var feed = require('../lib/feed');
var post = require('../lib/post');
var redisUtil = require('../lib/redis/redisUtil');
var follow = require('../lib/follow');
var dbUtil = require('../lib/db/dbUtil');
var cql = dbUtil.cql;
var dbClient = dbUtil.dbClient;

var assert = require("assert");
var should = require("should");

describe('FeedTest', function(){
  describe('AddPost', function(){
    it('flush current Redis db', function(){
      redisUtil.client.flushdb();
    });

    it('should add and get followers without error', function(done){
      follow.followUser('user1', 'user2');
      follow.followUser('user1', 'user3');
      follow.getFollowers('user1', function(err, follows){
        assert(follows.indexOf('user2')!=-1 && follows.indexOf('user3')!=-1, 'missing follower(s)');
      });
      done();
    });


    it('should add and get the post without error', function(done){
      var postId = cql.types.timeuuid();
      console.log('FeedTest, add post, postId=' + postId);
      feed.addPost(post.UserPost.createPost(
          postId,
          "user1",
          "R",
          "3m",
          null,
          "It is a test",
          null,
          null,
          null,
          null,
          null,
          "P",
          false,
          null,
          null,
          0,
          0,
          false,
          null),
          function(err, result){
          feed.getPost(postId, function(err, post){
            JSON.parse(post).userId.should.equal('user1');
            //assert.equal(JSON.parse(post).userId, 'user1');
            done();
          });
        });
      done();
    });

    it('should like get likes post without error', function(done){
      feed.likePost('post1', 'user2');
      feed.likePost('post1', 'user3');
      feed.getPostLikes('post1',function(err, result){
        redisUtil.redis.print(err, JSON.stringify(result));
        assert(result.length === 2);
        result.should.containEql('user2');
        result.should.containEql('user3');
        done();
      });
    });


    it('should publish a post to feed without error', function(done){
      feed.publishPostToFeeds('post1', 'user1', function(err, result){
        redisUtil.redis.print(err, JSON.stringify(result));
        feed.getFeed('user2', function(err, feeds){
          assert(feeds.indexOf('post1')!=-1 );
        });
        feed.getFeed('user3', function(err, feeds){
          assert(feeds.indexOf('post1')!=-1 );
        });
        done();
      });
    });

    it('should publish a post to feed without error', function(done){
      feed.addComment(feed.Comment.createComment('post1', 'comment1', 'user1', 'this is a comment 1'));
      feed.addComment(feed.Comment.createComment('post1', 'comment2', 'user1', 'this is a comment 2'));

      feed.getThread('post1',  function(err, result){
        redisUtil.redis.print(err, JSON.stringify(result));
        assert(result.length === 2);
        done();
      });
    });

  });

});