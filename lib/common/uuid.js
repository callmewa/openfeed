/**
 * The module contains logic about UUID.
 */

var nodeUuid = require('node-uuid');

/**
 * Convert Cassandra Time Uuid into Redis timeUuid.
 * @return string, Redis timeUuid, which is sequenced by time.
 */
function convertToRedisTimeUuid(cassandraTimeUuid) {
	return cassandraTimeUuid.replace(/^(.{8})-(.{4})-(.{4})/, '$3-$2-$1');
}

/** 
 * Get v1 UUID (timeUUID) value
 * We need to evaluate whether we need to supply node id into uuid.vi() call
 * in node cluster environment. 
 * See https://github.com/broofa/node-uuid/issues/82.
 * @return array[string, string], array[redis TimeUuid, cassandra TimeUuid], 
 * a newly generated v1 uuid (timeUuid). The redis version of TimeUuid makes
 * sure the timeUuid is sequenced by time.
 */
function genTimeUuid() {
	var dbTimeUuid = nodeUuid.v1();
	
	// See https://github.com/broofa/node-uuid/issues/75. Make generated 
	// timeUuid sequenced by time. 
	var redisTimeUuid = convertToRedisTimeUuid(dbTimeUuid);
	return [redisTimeUuid, dbTimeUuid];
}

/**
 * Get v4 UUID value
 * @return string, a newly generated v4 uuid.
 */
function genUuid() {
	return nodeUuid.v4();
}

exports.genTimeUuid = genTimeUuid;
exports.genUuid = genUuid;
