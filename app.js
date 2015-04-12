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
    callbackURL: INSTAGRAM_CALLBACK_URL,
    passReqToCallback: true
  },
  function(req, accessToken, refreshToken, profile, done) {

    // asynchronous
    process.nextTick(function() {

      if (!req.user) {
        console.log("signing up with Instagram");

        models.User.findOne({'instagram.id': profile.id}, function(err, user) {

          // if there is an error, stop everything and return that
          // ie an error connecting to the database
          if (err)
            return done(err);

          // if the user is found, then log them in
          if (user) {
            return done(null, user); // user found, return that user
          } else {
            // if there is no user found with that facebook id, create them
            console.log("Creating new user for Instagram profile:");
            console.log(profile);
            var newUser = new models.User();

            // set all of the facebook information in our user model
            newUser.instagram.id = profile.id; // set the users facebook id                   
            newUser.instagram.name = profile.username;
            newUser.instagram.access_token = accessToken; // we will save the token that facebook provides to the user                    
            
            console.log("New user:");
            console.log(newUser);

            // save our user to the database
            newUser.save(function(err) {
              if (err)
                return handleError(err);

              // if successful, return the new user
              return done(null, newUser);
            });
          }
        });


      
        // models.User.findOrCreate({
        //   'instagram.id': profile.id,
        //   'instagram.name': profile.username,
        //   'instagram.access_token': accessToken
        // }, function(err, user, created) {

        
        // // user is not logged in yet
        
        //   // created will be true here
        //   models.User.findOrCreate({}, function(err, user, created) {
        //     // created will be false here
        //     process.nextTick(function () {
        //       // To keep the example simple, the user's Instagram profile is returned to
        //       // represent the logged-in user.  In a typical application, you would want
        //       // to associate the Instagram account with a user record in your database,
        //       // and return that user instead.
        //       return done(null, profile);
        //     });
        //   });      
        // });

      } else {
        console.log("connecting Instagram");
        console.log("User in session:");
        console.log(req.user);
        console.log("User's _id:");
        console.log(req.user._id);

        // user is already logged in with another account; just link this one
        models.User.findOne({'_id': req.user._id}, function(err, user) {
          if (err)
            return done(err);

          // TODO: Maybe add check if user was found, but actually not needed as the user is searched by its DB id
          user.instagram.id = profile.id;
          user.instagram.name = profile.username;
          user.instagram.access_token = accessToken;
          user.save(function(err) {
            if (err)
              return handleError(err);
          });

          console.log("updated user");
          console.log(user);     
        });

        return done(null, req.user);       
   
      }
    });
  }
));

// TODO: Refactor this stuff to auth.js
passport.use(new FacebookStrategy({
    clientID: FACEBOOK_APP_ID,
    clientSecret: FACEBOOK_APP_SECRET,
    callbackURL: FACEBOOK_CALLBACK_URL,
    // TODO: Needed?
    enableProof: false,
    passReqToCallback: true
  },
  function(req, accessToken, refreshToken, profile, done) {
    // console.log(profile);

    // asynchronous
    process.nextTick(function() {

      if (!req.user) {
        console.log("Signing up with FB");
        // user is not logged in yet

        models.User.findOne({'facebook.id': profile.id}, function(err, user) {

          // if there is an error, stop everything and return that
          // ie an error connecting to the database
          if (err)
            return done(err);

          // if the user is found, then log them in
          if (user) {
            return done(null, user); // user found, return that user
          } else {
            // if there is no user found with that facebook id, create them
            var newUser = new models.User();

            console.log("Creating new user for FB profile:");
            console.log(profile);

            // set all of the facebook information in our user model
            newUser.facebook.id = profile.id; // set the users facebook id                   
            newUser.facebook.name = profile.displayName;
            newUser.facebook.access_token = accessToken; // we will save the token that facebook provides to the user                    
            
            console.log("New user:");
            console.log(newUser);

            // save our user to the database
            newUser.save(function(err) {
              if (err)
                throw err;

              // if successful, return the new user
              return done(null, newUser);
            });
            return done(null, newUser);
          }

        });
        // models.User.findOrCreate({
        //   'facebook.id': profile.id,
        //   'facebook.name': profile.username,
        //   'facebook.access_token': accessToken
        // }, function(err, user, created) {
        //   // TODO: Is the second findOrCreate needed?

        //   // created will be true here
        //   models.User.findOrCreate({}, function(err, user, created) {
        //     // created will be false here
        //     process.nextTick(function () {
        //       // To keep the example simple, the user's Instagram profile is returned to
        //       // represent the logged-in user.  In a typical application, you would want
        //       // to associate the Instagram account with a user record in your database,
        //       // and return that user instead.
        //       return done(null, profile);
        //     });
        //   });
        // });

      } else {
        console.log("Connecting FB");
        console.log("User in session:");
        console.log(req.user);
        // user is already logged in with another account; just link this one
        
        models.User.findOne({'_id': req.user._id}, function(err, user) {
          if (err)
            return done(err);

          user.facebook.id = profile.id;
          user.facebook.name = profile.displayName;
          user.facebook.access_token = accessToken;

          user.save(function(err) {
            if (err)
              handleError(err);
          });
        });
        return done(null, req.user);
      }
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
  // var facebook_user = null;
  // var instagram_user = null;
  // if (req.user) {
  //   if (req.user.provider == 'facebook') {
  //     facebook_user = req.user;
  //   }
  //   else if (req.user.provider == 'instagram') {
  //     instagram_user = req.user;
  //   }
  // }
  // console.log(facebook_user);
  // console.log(instagram_user);
  var params = {};
  if (req.user) {
    params = {facebook: req.user.facebook, instagram: req.user.instagram};
  }
  res.render('accounts', params);//, {facebook: req.user.facebook, instagram: req.user.instagram});
});


app.get('/', ensureAuthenticated, function(req, res) {
  // User is logged in _either_ via FB or Instagram


  models.User.findOne({'_id': req.user._id}, function(err, user) {
    if (err) return handleError(err);
    if (user) {
      console.log("getting photos for user:");
      console.log(user);

      var imageArr = [];

      if (user.instagram) {
        console.log("getting instagram");
        Instagram.users.self({
          access_token: user.instagram.access_token,
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
              if (user_names.indexOf(user.instagram.name) != -1) {
                // current user is tagged in the photo
                // console.log("gotcha");
                var tempJSON = {};
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
                if (item.user.id == user.instagram.id) {
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

      console.log("processed instagram, imageArr so far:");
      console.log(imageArr);

              }
            }
          

      

      if (user.facebook) {
        console.log("getting facebook");
        // console.log(Facebook.getAccessToken());
        // TODO: Do not set this at every call
        Facebook.setAccessToken(user.facebook.access_token);

        Facebook.get('/' + user.facebook.id + '/photos', function(err, response) {
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
                var tempJSON = {};
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
                if (item.from.id == user.facebook.id) {
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

          // TODO: The calls to instagram and fb are async; render this after they have completed separately

          // TODO: Sort by time
          // imageArr.sort(function(a, b) {
          //   return a.
          // });
          res.render('browse', {photos: imageArr});
        });

      console.log(imageArr);
      }
      }
        });
    }
    }
  });
});


// app.get('/favorites', function(req, res) {
//   res.render('favorites');
// });



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
  passport.authenticate('facebook', {scope: ['user_photos'] }));

// TODO: Handle failureRedirect
// TODO: Handle via successRedirect or show toast etc
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
