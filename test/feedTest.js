/**
 * Created by zwang on 7/30/14.
 */
//TODO: use should.js

var feed = require('../lib/feed');
var assert = require("assert");

describe('FeedTest', function(){
  describe('AddPost', function(){
    it('drop current database', function(){
      feed.client.flushdb();
    });

    it('should add and get followers without error', function(done){
      feed.followUser('user1', 'user2');
      feed.followUser('user1', 'user3');
      feed.getFollowers('user1', function(err, follows){
        assert(follows.indexOf('user2')!=-1 && follows.indexOf('user3')!=-1, 'missing follower(s)');
      });
      done();
    });


    it('should add and get the post without error', function(done){
      feed.addPost(feed.UserPost.createPost('post1', 'user1', 'text', 'blah blah blah'));
      feed.getPost('post1', function(err, post){
        assert.equal(JSON.parse(post).userId, 'user1');
      });
      done();
    });

    //TODO: this need to be async or promised
    it('should publish a post to feed without error', function(done){
      feed.publishPostToFeeds('post1', 'user1', function(err, result){
        console.log('published feed ' + result);
      });
      feed.getFeed('user2');
      feed.getFeed('user3', function(err, feeds){
        console.log(feeds);
        done();
      });

    });



  })
});