/**
 * This file contains logic for creating promises for db operations.
 */

var Q = require('q');
var cql = require('node-cassandra-cql'),
  dbClient = new cql.Client({hosts: ['localhost'], keyspace: 'myks'});

/**
 * @param query database query
 * @param parameters query parameters
 * @param consistency query consistency
 * @returns promise for the query
 */
function genQueryPromise(query, parameters, consistency) {
  var deferred = Q.defer();
  dbClient.execute(query, parameters,
    function(err, result) {
      if (err) {
        console.error(
            'error in query: ' + query + ", parameters: " + parameters);
        deferred.reject(new Error(err));
      } else {
        console.log("Query succeeded: " + query);
        deferred.resolve(result);
      }
    }
  );
  return deferred.promise;
}

exports.genQueryPromise = genQueryPromise;