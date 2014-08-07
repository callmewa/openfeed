/**
 * Unit tests for common/uuid.js
 */
//TODO: use should.js

var uuid = require('../lib/common/uuid');
var assert = require("assert");
var should = require("should");

describe('UuidTest', function(){
	it('genTimeUuid should return the correct format', function(done){
	    var redisTimeUuid = uuid.genTimeUuid()[0];
        assert(redisTimeUuid.match(/^(.{4})-(.{4})-(.{8})/));
        done();
	  });
	it('Redis timeUuid is reformatted from dbTimeUuid', function(done){
	    var timeUuids = uuid.genTimeUuid();
		var redisTimeUuid = timeUuids[0];
	    var dbTimeUuid = timeUuids[1];
        assert(dbTimeUuid.replace(/^(.{8})-(.{4})-(.{4})/, 
        		'$3-$2-$1') == redisTimeUuid);
        done();
	  });
});