/**
 * Created by zwang on 7/30/14.
 */
//TODO: use should.js

var feed = require('../lib/feed');
var assert = require("assert");

describe('FeedTest', function(){
  describe('AddPost', function(){
    it('should add the post without error', function(done){
      feed.addPost(feed.UserPost.createPost('post1', 'user1', 'text', 'blah blah blah'));
      feed.getPost('post1', function(err, post){
        assert.equal(JSON.parse(post).userId, 'user1');

        console.log(post);
      });
      done();
    })
  })
});