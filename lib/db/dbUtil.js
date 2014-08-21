/**
 * This file contains utils for Cassandra db.
 */

var cql = require('node-cassandra-cql'),
  dbClient = new cql.Client({hosts: ['localhost'], keyspace: 'myks'});

exports.cql = cql;
exports.dbClient = dbClient;