/**
 * Created by wa on 8/25/14.
 */

var assert = require("assert");
var should = require("should");
var FeedService = require("../lib/feedService"),
  service = new FeedService(),
  Events = FeedService.Events;

describe('FeedTest', function() {
  before(function(){
    service.on(Events.followUser, function(data){
      console.log(data);
    })
  });

  describe('Follow user', function() {
    it('should add and get followers without error', function(done) {
      service.followUser('user1', 'user2');
      done();
    });
  });
});