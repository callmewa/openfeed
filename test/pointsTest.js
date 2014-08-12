/**
 * Unit tests for points.js.
 */
//TODO: use should.js

var points = require('../lib/points');
var assert = require("assert");
var should = require("should");

describe('PointsTest', function() {
  describe('ChangePoints', function() {
    it('drop current database', function() {
      points.client.flushdb();
    });

    it('should change points without error', function(done) {
      // FIXME (wa), points.changePoints seems to take no effect. Don't know why.
      points.changePoints('pkdebug10', 100, 'unit test');
      points.getPointsFromMemory('pkdebug10', function(err, userPoints) {
        assert(userPoints == 100, 'missing user points, userPoints=' + userPoints);
      });
      done();
    });
  });

});