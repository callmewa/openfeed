/**
 * This file contains logic for post categories, e.g. 3m, 1y, etc.
 */

/**
 * @returns an array of all post categories
 * TODO (kpan), this data should come from Cassandra db.
 */
function getPostCategires() {
  return ['0m', '1m', '2m', '3m',
          '4m', '5m', '6m', '7m',
          '8m', '9m', '10m', '11m',
          '1y', '1.5y', '2y', '2.5y',
          '3y', '3.5y', '4y', '4.5y',
          '5y', '5.5y', '6y', '6.5y',
          '7y', '7.5y', '8y', '8.5y',
          '9y', '9.5y', '10y', '10.5y',
          '11y', '11.5y', '12y', '12.5y',
          '13y', '13.5y', '14y', '14.5y',
          '15y', '15.5y', '16y', '16.5y',
          '17y', '17.5y', '18y', '18.5y',
          '19y'];
}

exports.getPostCategires = getPostCategires;

// TODO (kpan): add unit tests for addPoints* functions.