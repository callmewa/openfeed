/**
 * Created by wa on 8/31/14.
 */

var debug = require('debug')('app');
var express = require('express');
var bodyParser = require('body-parser');
var passport = require('passport')
  , BasicStrategy = require('passport-http').BasicStrategy;

var app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));


// passport authentication
app.use(passport.initialize());
passport.use(new BasicStrategy(
  function(username, password, done) {
    return done(null, {username: username});
  }
));

// requires {"usename": "xxx", "password": "xxx"}
var authenticate = passport.authenticate('basic', { session: false });

// for test only
app.post('/login',
  authenticate,
  function(req, res) {
    // If this function gets called, authentication was successful.
    // `req.user` contains the authenticated user.
    res.json(req.user.username);
  });


// list of routes
var feedApi = require('./routes/feed');
app.get('/api/v1', function(req, res) {
  res.json({api: "feedService", version: 1});
});

// follow someone
app.post('/api/v1/user/follow', feedApi.addFollower);

// New post
app.post('/api/v1/post/', authenticate, feedApi.addPost);

// Load feed
app.get('/api/v1/feed', feedApi.getFeed);

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