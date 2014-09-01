/**
 * Created by wa on 8/31/14.
 */

var debug = require('debug')('app');
var express = require('express');
var bodyParser = require('body-parser');

var app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));

// list of routes
var feedApi = require('./routes/feed');
app.get('/api/v1', function(req, res) {
  res.json({api: "feedService", version: 1});
});
app.post('/api/v1/user/follow', feedApi.addFollower);



// catch 404 and forwarding to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

/// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.json({
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.json({
    message: err.message,
    error: {}
  });
});


module.exports = app;

var server = app.listen(3000, function() {
  debug('Express server listening on port ' + server.address().port);
});

process.on('uncaughtException', function(err) {
  console.error('Caught exception: ' + err.stack , err);
});