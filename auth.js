var passport = require('passport');
var dotenv = require('dotenv');
var InstagramStrategy = require('passport-instagram').Strategy;
var FacebookStrategy = require('passport-facebook').Strategy;
var Instagram = require('instagram-node-lib');
var Facebook = require('fbgraph');
var country_language = require('country-language');

var models = require('./models');

dotenv.load();
var INSTAGRAM_CLIENT_ID = process.env.instagram_client_id;
var INSTAGRAM_CLIENT_SECRET = process.env.instagram_client_secret;
var INSTAGRAM_CALLBACK_URL = process.env.instagram_callback_url;
var INSTAGRAM_ACCESS_TOKEN = "";

var FACEBOOK_APP_ID = process.env.facebook_app_id;
var FACEBOOK_APP_SECRET = process.env.facebook_app_secret;
var FACEBOOK_CALLBACK_URL = process.env.facebook_callback_url;

// Setup instagram API
Instagram.set('client_id', INSTAGRAM_CLIENT_ID);
Instagram.set('client_secret', INSTAGRAM_CLIENT_SECRET);

exports.passport = passport;
exports.Instagram = Instagram;
exports.Facebook = Facebook;

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
  	// console.log(profile);
    // asynchronous
    process.nextTick(function() {

      if (!req.user) {
        console.log("Signing in with Instagram");

        models.User.findOne({'instagram.id': profile.id}, function(err, user) {
          if (err)
            return done(err);

          // if the user is found, then log them in
          if (user) {
            if (updateInstagramInformation(user, profile)) {
              user.save(function(err) {
                if (err)
                  return handleError(err);

                return done(null, user);
              });
            } else {
              return done(null, user); // user found, return that user
            }
          } else {
            // if there is no user found with that facebook id, create them
            // console.log("Creating new user for Instagram profile:");
            // console.log(profile);
            var newUser = new models.User();

            // set all of the facebook information in our user model
            newUser.instagram.id = profile.id; // set the users facebook id
            newUser.instagram.access_token = accessToken; // we will save the token that facebook provides to the user                    
            updateInstagramInformation(user, profile);

            // console.log("New user:");
            // console.log(newUser);

            // save our user to the database
            newUser.save(function(err) {
              if (err)
                return handleError(err);

              // if successful, return the new user
              return done(null, newUser);
            });
          }
        });

      } else {
        // console.log("connecting Instagram");
        // console.log("User in session:");
        // console.log(req.user);
        // console.log("User's _id:");
        // console.log(req.user._id);

        // user is already logged in with another account; just add this one to his database record
        models.User.findOne({'_id': req.user._id}, function(err, user) {
          if (err)
            return done(err);

          // TODO: Maybe refactor this and the stuff above to extra variables
          // TODO: Maybe add check if user was found, but actually not needed as the user is searched by its DB id
          user.instagram.id = profile.id;
          user.instagram.access_token = accessToken;
          updateInstagramInformation(user, profile);
          user.save(function(err) {
            if (err)
              return handleError(err);
            return done(null, user);
          });

          // console.log("updated user");
          // console.log(user);     
        });    
   
      }
    });
  }
));


function updateInstagramInformation(user, profile) {
  var anythingChanged = false;

  var name = profile.username;

  if (user.instagram.name != name) {
    user.instagram.name = name;
    anythingChanged = true;
  }

  var description = profile._json.data.bio;
  if (user.instagram.description != description) {
    user.instagram.description = description;
    anythingChanged = true;
  }

  return anythingChanged;
}




passport.use(new FacebookStrategy({
    clientID: FACEBOOK_APP_ID,
    clientSecret: FACEBOOK_APP_SECRET,
    callbackURL: FACEBOOK_CALLBACK_URL,
    passReqToCallback: true
  },
  function(req, accessToken, refreshToken, profile, done) {
    // console.log(profile);

    // asynchronous
    // console.log(profile);
    process.nextTick(function() {

      if (!req.user) {
        console.log("Signing in with Facebook");
        // user is not logged in yet
        // console.log(profile);

        models.User.findOne({'facebook.id': profile.id}, function(err, user) {

          // if there is an error, stop everything and return that
          // ie an error connecting to the database
          if (err)
            return done(err);

          // if the user is found, then log them in
          if (user) {
            if (updateFacebookInformation(user, profile)) {
              // Only affect database record if anything was changed
              user.save(function(err) {
                if (err)
                  return handleError(err);

                return done(null, user);
              });
            } else {
              return done(null, user);
            }
          } else {
            // if there is no user found with that facebook id, create them
            var newUser = new models.User();

            // console.log("Creating new user for FB profile:");
            // console.log(profile);

            // set all of the facebook information in our user model
            newUser.facebook.id = profile.id; // set the users facebook id
            newUser.facebook.access_token = accessToken; // we will save the token that facebook provides to the user                    
            updateFacebookInformation(newUser, profile);

            // console.log("New user:");
            // console.log(newUser);

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

      } else {
        // console.log("Connecting FB");
        // console.log("User in session:");
        // console.log(req.user);

        // user is already logged in with another account; just add this one to his database record        
        models.User.findOne({'_id': req.user._id}, function(err, user) {
          if (err)
            return done(err);

          user.facebook.id = profile.id;
          user.facebook.access_token = accessToken;
          updateFacebookInformation(user, profile);

          user.save(function(err) {
            if (err)
              handleError(err);
            return done(null, user);
          });
        });
      }
    });
  }
));

function updateFacebookInformation(user, profile) {
  var anythingChanged = false;

  var name = profile.displayName;
  if (user.facebook.name != name) {
    user.facebook.name = name;
    anythingChanged = true;
  }

  var description = capitalizeFirstLetter(profile._json.gender);
  var country = country_language.getCountry(profile._json.locale.slice(3)).name;
  if (country) {
    if (description)
      description += ", from ";
    else
      description += "From ";
    description += country;
  }
  if (user.facebook.description != description) {
    user.facebook.description = description;
    anythingChanged = true;
  }

  return anythingChanged;
}


// TODO: Maybe refactor to helpers.js
// Helper functions
function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}
