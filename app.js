//dependencies for each module used
var express = require('express');
var http = require('http');
var path = require('path');
var handlebars = require('express-handlebars');
var bodyParser = require('body-parser');
var session = require('express-session');
var cookieParser = require('cookie-parser');
var mongoose = require('mongoose');
var _ = require('lodash');
var flash = require('connect-flash');
var app = express();

//local dependencies
var auth = require('./auth');
// TODO: Maybe rename these
var Instagram = auth.Instagram;
var Facebook = auth.Facebook;

//connect to database
mongoose.connect(process.env.mongodb_connection_url);
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function (callback) {
  console.log("Database connected succesfully.");
});


//Configures the Template engine
app.engine('handlebars', handlebars({defaultLayout: 'layout'}));
app.set('view engine', 'handlebars');
app.set('views', __dirname + '/views');
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(session({ secret: 'keyboard cat',
                  saveUninitialized: true,
                  resave: true}));
app.use(flash());
app.use(auth.passport.initialize());
app.use(auth.passport.session());

//set environment ports and start application
app.set('port', process.env.PORT || 3000);

// Simple route middleware to ensure user is authenticated.
//   Use this route middleware on any resource that needs to be protected.  If
//   the request is authenticated (typically via a persistent login session),
//   the request will proceed.  Otherwise, the user will be redirected to the
//   login page.
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next(); 
  } else {
    res.redirect('/connect');
  }
}


app.get('/connect', function(req, res) {
  if (!req.isAuthenticated()) {
    res.render('not_connected');
  } else {
    if (req.user.facebook && req.user.instagram)
      res.render('completely_connected', {facebook: req.user.facebook, instagram: req.user.instagram});
    else  // only one of them
      res.render('partially_connected', {facebook: req.user.facebook, instagram: req.user.instagram});
  }  
});


app.get('/disconnect', function(req, res) {
  req.logout();
  res.redirect('/connect');
});


app.get('/accounts', ensureAuthenticated, function(req, res) {
  res.render('accounts', {facebook: req.user.facebook, instagram: req.user.instagram});
});


app.get('/', ensureAuthenticated, function(req, res) {
  var user = req.user;
  var imageArr = [];

  var async_finished = _.after(2, function() {
      if (imageArr.length === 0) {
        res.render('no_photos');
      } else {
        imageArr.sort(function(a, b) {
          return b.timestamp - a.timestamp;
        });
        res.render('browse', {photos: imageArr});            
      }
    });

  if (req.user.instagram) {
    // console.log("getting instagram");
    Instagram.users.self({
      access_token: req.user.instagram.access_token,
      complete: function(data) {
        // console.log("got data from instagram:");
        // console.log(data);
        for (var i = 0; i < data.length; i++) {
          var item = data[i];

          // TODO: Maybe use positon of tag and show an overlay on the photo
          var user_names = item.users_in_photo.map(function(user_item) {
            return user_item.user.username;
          });
          // console.log(user_names);

          // TODO: Use user id instead
          if (user_names.indexOf(req.user.instagram.name) != -1) {
            // current user is tagged in the photo
            var tempJSON = {};
            tempJSON.image_url = item.images.low_resolution.url;
            tempJSON.link = item.link;

            if (item.caption) {
              tempJSON.caption = item.caption.text;
            } else {
              tempJSON.caption = null;
            }
            if (item.user.id == req.user.instagram.id) {
              tempJSON.from = 'You';
            } else {
              tempJSON.from = item.user.username;
            }

            var date = new Date(parseInt(item.created_time) * 1000);
            tempJSON.timestamp = date.getTime();
            tempJSON.day = date.getDate();
            tempJSON.month = date.getMonth() + 1;
            tempJSON.year = date.getFullYear();
            imageArr.push(tempJSON);
          }
        }
        async_finished();
      }
    });
  } else {
    async_finished();
  }      
  

  if (req.user.facebook) {
    Facebook.get('/me/photos?access_token=' + req.user.facebook.access_token, 
      function(err, response) {
        for (var i = 0; i < response.data.length; i++) {
          // Facebook already gives the photos the user was tagged on, so we will show each one

          var item = response.data[i];

          var tempJSON = {};
          tempJSON.image_url = item.source;
          tempJSON.link = item.link;

          if (item.name) {
            tempJSON.caption = item.name;
          } else {
            tempJSON.caption = null;
          }
          if (item.from.id == req.user.facebook.id) {
            tempJSON.from = 'You';
          } else {
            tempJSON.from = item.from.name;
          }

          var date = new Date(item.created_time);
          tempJSON.timestamp = date.getTime();
          // console.log(date.getDay() + "." + date.getMonth() + "." + date.getYear());
          tempJSON.day = date.getDate();
          tempJSON.month = date.getMonth() + 1;
          tempJSON.year = date.getFullYear();
          imageArr.push(tempJSON);
        }
        async_finished();
    });
  } else {
    async_finished();
  }
});


app.get('/error', function(req, res) {
  res.render('error');
});


app.get('/auth/instagram',
  auth.passport.authenticate('instagram'));

app.get('/auth/instagram/callback', 
  auth.passport.authenticate('instagram', {successRedirect: 'back', failureRedirect: '/error'}));

app.get('/auth/facebook',
  auth.passport.authenticate('facebook', {scope: ['user_photos'] }));

app.get('/auth/facebook/callback',
  auth.passport.authenticate('facebook', {successRedirect: 'back', failureRedirect: '/error'}));


http.createServer(app).listen(app.get('port'), function() {
    console.log('Express server listening on port ' + app.get('port'));
});
