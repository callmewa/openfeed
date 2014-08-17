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
  dbClient.execute(query, parameters, consistency,
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


/**
 * @param query database query
 * @param parameters array of array, batch query parameters
 * @param consistency query consistency
 * @returns promise for the batch query based on the same query
 */
function genBatchQueryPromise(query, parameters, consistency) {
  var batchQuery = [];
  parameters.forEach(function (parameter) {
    batchQuery.push({query: query, params: parameter});
  });
  
  var deferred = Q.defer();
  dbClient.executeBatch(batchQuery, consistency,
    function(err, result) {
      if (err) {
        console.error(
            'error in batch query: ' + query + ", parameters: " + parameters);
        deferred.reject(new Error(err));
      } else {
        console.log("Batch query succeeded: " + JSON.stringify(batchQuery));
        deferred.resolve(result);
      }
    }
  );
  return deferred.promise;
}

exports.genQueryPromise = genQueryPromise;
exports.genBatchQueryPromise = genBatchQueryPromise;