//dependencies for each module used
var express = require('express');
var passport = require('passport');
var InstagramStrategy = require('passport-instagram').Strategy;
var FacebookStrategy = require('passport-facebook').Strategy;
var http = require('http');
var path = require('path');
var handlebars = require('express-handlebars');
var bodyParser = require('body-parser');
var session = require('express-session');
var cookieParser = require('cookie-parser');
var dotenv = require('dotenv');
var Instagram = require('instagram-node-lib');
var Facebook = require('fbgraph');
var mongoose = require('mongoose');
var app = express();

//local dependencies
var models = require('./models');

//client id and client secret here, taken from .env
dotenv.load();
var INSTAGRAM_CLIENT_ID = process.env.instagram_client_id;
var INSTAGRAM_CLIENT_SECRET = process.env.instagram_client_secret;
var INSTAGRAM_CALLBACK_URL = process.env.instagram_callback_url;
var INSTAGRAM_ACCESS_TOKEN = "";
Instagram.set('client_id', INSTAGRAM_CLIENT_ID);
Instagram.set('client_secret', INSTAGRAM_CLIENT_SECRET);

var FACEBOOK_APP_ID = process.env.facebook_app_id;
var FACEBOOK_APP_SECRET = process.env.facebook_app_secret;
var FACEBOOK_CALLBACK_URL = process.env.facebook_callback_url;
// Facebook.setAppId(FACEBOOK_APP_ID);
// Facebook.setAppSecret(FACEBOOK_APP_SECRET);
// TODO: set config parameters for FB API

//connect to database
mongoose.connect(process.env.mongodb_connection_url);
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function (callback) {
  console.log("Database connected succesfully.");
});

// Passport session setup.
//   To support persistent login sessions, Passport needs to be able to
//   serialize users into and deserialize users out of the session.  Typically,
//   this will be as simple as storing the user ID when serializing, and finding
//   the user by ID when deserializing.  However, since this example does not
//   have a database of user records, the complete Instagram profile is
//   serialized and deserialized.
passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  done(null, obj);
});


// Use the InstagramStrategy within Passport.
//   Strategies in Passport require a `verify` function, which accept
//   credentials (in this case, an accessToken, refreshToken, and Instagram
//   profile), and invoke a callback with a user object.
passport.use(new InstagramStrategy({
    clientID: INSTAGRAM_CLIENT_ID,
    clientSecret: INSTAGRAM_CLIENT_SECRET,
    callbackURL: INSTAGRAM_CALLBACK_URL
  },
  function(accessToken, refreshToken, profile, done) {
    // asynchronous verification, for effect...

    models.User.findOrCreate({
      "name": profile.username,
      "id": profile.id,
      "access_token": accessToken,
      "provider": "instagram"
    }, function(err, user, created) {
      
      // created will be true here
      models.User.findOrCreate({}, function(err, user, created) {
        // created will be false here
        process.nextTick(function () {
          // To keep the example simple, the user's Instagram profile is returned to
          // represent the logged-in user.  In a typical application, you would want
          // to associate the Instagram account with a user record in your database,
          // and return that user instead.
          return done(null, profile);
        });
      });
    });
  }
));

passport.use(new FacebookStrategy({
    clientID: FACEBOOK_APP_ID,
    clientSecret: FACEBOOK_APP_SECRET,
    callbackURL: FACEBOOK_CALLBACK_URL,
    enableProof: false
  },
  function(accessToken, refreshToken, profile, done) {
    // console.log(profile);
    models.User.findOrCreate({
      "name": profile.username,
      "id": profile.id,
      "access_token": accessToken,
      "provider": 'facebook'
    }, function(err, user, created) {
      // TODO: Copied from instagram; does this work for FB?

      // created will be true here
      models.User.findOrCreate({}, function(err, user, created) {
        // created will be false here
        process.nextTick(function () {
          // To keep the example simple, the user's Instagram profile is returned to
          // represent the logged-in user.  In a typical application, you would want
          // to associate the Instagram account with a user record in your database,
          // and return that user instead.
          return done(null, profile);
        });
      });
    });
  }
));


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
app.use(passport.initialize());
app.use(passport.session());

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
  }
  // TODO: Handle situation if no account is connected
  res.render('no_content');
}

app.get('/accounts', function(req, res) {
  // console.log(req.account);
  // console.log("");
  // console.log("========================");
  // console.log("");
  var facebook_user = null;
  var instagram_user = null;
  if (req.user) {
    if (req.user.provider == 'facebook') {
      facebook_user = req.user;
    }
    else if (req.user.provider == 'instagram') {
      instagram_user = req.user;
    }
  }
  // console.log(facebook_user);
  // console.log(instagram_user);
  res.render('accounts', {facebook_user: facebook_user, instagram_user: instagram_user});
});


app.get('/', ensureAuthenticated, function(req, res) {
  // User is logged in _either_ via FB or Instagram

  var query = models.User.where({provider: req.user.provider, id: req.user.id});
  query.findOne(function(err, user) {
    if (err) return handleError(err);
    if (user) {
      if (user.provider == 'instagram') {
        Instagram.users.self({
          access_token: user.access_token,
          complete: function(data) {
            var imageArr = [];
            for (var i = 0; i < data.length; i++) {
              var item = data[i];

              // TODO: Maybe use positon of tag and show an overlay on the photo
              var user_names = item.users_in_photo.map(function(user_item) {
                return user_item.user.username;
              });
              // console.log(user_names);

              if (user_names.indexOf(user.name) != -1) {
                // current user is tagged in the photo
                // console.log("gotcha");
                tempJSON = {};
                tempJSON.image_url = item.images.low_resolution.url;
                tempJSON.link = item.link;
                tempJSON.provider = 'Instagram';
                // console.log("===================");
                // console.log("ITEM:");
                // console.log(item);
                // console.log("-------------------");
                // console.log("CAPTION:");
                // console.log(item.caption);
                // console.log("===================");
                if (item.caption) {
                  tempJSON.caption = item.caption.text;
                } else {
                  tempJSON.caption = null;
                }
                if (item.user.id == user.id) {
                  tempJSON.from = 'You';
                } else {
                  tempJSON.from = item.user.username;
                }
                // tempJSON.profile_picture = item.user.profile_picture;
                var date = new Date(parseInt(item.created_time) * 1000);
                tempJSON.day = date.getDate();
                tempJSON.month = date.getMonth() + 1;
                tempJSON.year = date.getFullYear();
                imageArr.push(tempJSON);
              }
            }
            res.render('browse', {photos: imageArr});
          }
        });
      } else if (user.provider == 'facebook') {
        // console.log(Facebook.getAccessToken());
        Facebook.setAccessToken(user.access_token);

        Facebook.get('/' + user.id + '/photos', function(err, response) {
          var imageArr = [];
            for (var i = 0; i < response.data.length; i++) {
              var item = response.data[i];

              // // TODO: Maybe use positon of tag and show an overlay on the photo
              // var user_names = item.users_in_photo.map(function(user_item) {
              //   return user_item.user.username;
              // });
              // // console.log(user_names);

              // if (user_names.indexOf(user.name) != -1) {
                // current user is tagged in the photo
                // console.log("gotcha");
                tempJSON = {};
                tempJSON.image_url = item.source;
                tempJSON.link = item.link;
                tempJSON.provider = 'Facebook';
                // console.log("===================");
                // console.log("ITEM:");
                // console.log(item);
                // console.log("-------------------");
                // console.log("CAPTION:");
                // console.log(item.caption);
                // console.log("===================");
                if (item.name) {
                  tempJSON.caption = item.name;
                } else {
                  tempJSON.caption = null;
                }
                if (item.from.id == user.id) {
                  tempJSON.from = 'You';
                } else {
                  tempJSON.from = item.from.name;
                }
                // TODO: Get profile picture, probably through user id and graph api
                // tempJSON.profile_picture = item.user.profile_picture;
                var date = new Date(item.created_time);
                // console.log(date.getDay() + "." + date.getMonth() + "." + date.getYear());
                tempJSON.day = date.getDate();
                tempJSON.month = date.getMonth() + 1;
                tempJSON.year = date.getFullYear();
                imageArr.push(tempJSON);
              // }
            }

          res.render('browse', {photos: imageArr});
        });
      } else {
        res.send('Something went wrong. Could not recognize this user account');
      }
    }
  });
});


app.get('/favorites', function(req, res) {
  res.render('favorites');
});



// TODO - high priority: Allow multiple accounts at the same time by including authorize (vs authenticate), see here: http://passportjs.org/guide/authorize/


app.get('/auth/instagram',
  passport.authenticate('instagram'));

app.get('/auth/instagram/callback', 
  passport.authenticate('instagram', {failureRedirect: '/accounts'}),
  function(req, res) {
    // TODO: Redirect to previous page
    res.redirect('/accounts');
  });


app.get('/auth/facebook',
  passport.authenticate('facebook', { scope: ['user_photos'] }));

// TODO: Handle failureRedirect
app.get('/auth/facebook/callback',
  passport.authenticate('facebook', {failureRedirect: '/accounts'}),
  function(req, res) {
    res.redirect('/accounts');
  });


app.get('/logout', function(req, res) {
  req.logout();
  res.redirect('/accounts');
});


http.createServer(app).listen(app.get('port'), function() {
    console.log('Express server listening on port ' + app.get('port'));
});
