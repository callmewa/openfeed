/**
 * This file contains logic that gets system settings.
 */

var cql = require('node-cassandra-cql'),
  dbClient = new cql.Client({hosts: ['localhost'], keyspace: 'myks'});

/**
 * System settings object
 */
var systemSettings = {
  // Int, Number of days’ posts that are saved in Redis
  postsDaysInMemory: null,
  // Int, Points assigned to a new user
  newUserPoints: null,
  // Int, Points earned per post
  newPostPoints: null,
  // Int, Points earned per comment by the author of a comment
  myCommentPoints: null,
  // Int, Points earned per comment by other users
  theirCommentPoints: null,
  // Int, Points earned per like by other users
  theirLikePoints: null,
  // Int, Valid post character count thredhold. A post that contains more 
  // than 30 character will receive points.
  minValidPostCharCount: null,
  // Int, cost of points for asking a question.
  questionCost: null,
};

/**
 * Load system settings from system_settings table in db.
 * This function should be called when node server is started and 
 * called once of the data in system_settings table is changed.
 */
function loadFromDb() {
  dbClient.eachRow('SELECT name, value FROM system_settings',
    function(n, row) {
      console.log('got system setting ' + row.name + ": "+ row.value);
      systemSettings[row.name] = row.value;
  },
  function (err, rowLength) {
    if (err) {
      console.log('execute failed: ' + err);
    }
    console.log('%d rows where returned', rowLength);
  });
}

/**
 * @return integer, the number of days the posts should be saved in Redis.
 */
function getPostsDaysInMemory() {
  if (systemSettings.postsDaysInMemory === null) {
    return 90;
  } else {
  return systemSettings.postsDaysInMemory;
  }
}

/**
 * @return integer, Points assigned to a new user.
 */
function getNewUserPoints() {
  if (systemSettings.newUserPoints === null) {
    return 1000;
  } else {
    return systemSettings.newUserPoints;
  }
}

/**
 * @return integer, Points earned per post
 */
function getNewPostPoints() {
  if (systemSettings.newPostPoints === null) {
    return 20;
  } else {
    return systemSettings.newPostPoints;
  }
}

/**
 * @return integer, Points earned per comment by the author of a comment.
 */
function getMyCommentPoints() {
  if (systemSettings.myCommentPoints === null) {
    return 5;
  } else {
    return systemSettings.myCommentPoints;
  }
}

/**
 * @return integer, Points earned per like by other users.
 */
function getTheirCommentPoints() {
  if (systemSettings.theirCommentPoints === null) {
    return 10;
  } else {
    return systemSettings.theirCommentPoints;
  }
}

/**
 * @return integer, Points earned per like by other users.
 */
function getTheirLikePoints() {
  if (systemSettings.theirLikePoints === null) {
    return 5;
  } else {
    return systemSettings.theirLikePoints;
  }
}

/**
 * @return integer, Valid post character count threshold. A post that contains
 * more than x character will receive points.
 */
function getMinValidPostCharCount() {
  if (systemSettings.minValidPostCharCount === null) {
    return 30;
  } else {
    return systemSettings.minValidPostCharCount;
  }
}

/**
 * @return integer, cost of points for asking a question.
 */
function getQuestionCost() {
  if (systemSettings.questionCost === null) {
    return 100;
  } else {
    return systemSettings.questionCost;
  }
}

exports.getNewPostPoints = getNewPostPoints;
exports.getMyCommentPoints = getMyCommentPoints;
exports.getTheirCommentPoints = getTheirCommentPoints;
exports.getTheirLikePoints = getTheirLikePoints;
// TODO (kpan): add unit tests