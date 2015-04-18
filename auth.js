var passport = require('passport');
var dotenv = require('dotenv');
var InstagramStrategy = require('passport-instagram').Strategy;
var FacebookStrategy = require('passport-facebook').Strategy;
var Instagram = require('instagram-node-lib');
var Facebook = require('fbgraph');
var country_language = require('country-language');

var models = require('./models');

// Load environment variables from .env file
dotenv.load();

// Setup Instagram API
Instagram.set('client_id', process.env.instagram_client_id);
Instagram.set('client_secret', process.env.instagram_client_secret);

exports.passport = passport;
exports.Instagram = Instagram;
exports.Facebook = Facebook;

// Passport session setup
passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  done(null, obj);
});


/*
 * Configure passport to work with Facebook authentication
 */
passport.use(new FacebookStrategy({
    clientID: process.env.facebook_app_id,
    clientSecret: process.env.facebook_app_secret,
    callbackURL: process.env.facebook_callback_url,
    passReqToCallback: true
  },
  function(req, accessToken, refreshToken, profile, done) {
    process.nextTick(function() {  // asynchronous

      if (!req.user) {  // User is not logged in at all
        console.log("Signing in with Facebook");
        models.User.findOne({'facebook.id': profile.id}, function(err, user) {
          if (err)
            return done(err);

          if (user) {  // Database record for this Facebook account exists, just update it
            return updateFacebookInformation(user, profile, accessToken, done);
          } else {  // Create a new database record
            updateFacebookInformation(new models.User(), profile, accessToken, done);
          }
        });

      } else {
        // User is already logged in with another account
        // Retrieve his database record and add the Facebook account
        models.User.findOne({'_id': req.user._id}, function(err, user) {
          if (err)
            return done(err);

          return updateFacebookInformation(user, profile, accessToken, done);

        });
      }
    });
  }
));

/*
 * Update all Facebook data in 'user' with the information from 'profile' and 'access_token'
 * If anything was changed, save it to the database
 */
function updateFacebookInformation(user, profile, access_token, done) {
  var anythingChanged = false;

  if (user.facebook.id != profile.id) {
    user.facebook.id = profile.id;
    anythingChanged = true;
  }

  if (user.facebook.access_token != access_token) {
    user.facebook.access_token = access_token; // we will save the token that facebook provides to the user                    
    anythingChanged = true;
  }

  if (user.facebook.name != profile.displayName) {
    user.facebook.name = profile.displayName;
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

  if (anythingChanged) {
    user.save(function(err) {
      if (err)
        return done(err);
      return done(null, user);
      });
  }
}



/*
 * Configure passport to work with Facebook authentication
 */
passport.use(new InstagramStrategy({
    clientID: process.env.instagram_client_id,
    clientSecret: process.env.instagram_client_secret,
    callbackURL: process.env.instagram_callback_url,
    passReqToCallback: true
  },
  function(req, accessToken, refreshToken, profile, done) {
    process.nextTick(function() {  // asynchronous

      if (!req.user) {  // User is not logged in at all
        console.log("Signing in with Instagram");

        models.User.findOne({'instagram.id': profile.id}, function(err, user) {
          if (err)
            return done(err);

          if (user) {  // Database record for this Instagram account exists, just update it
            return updateInstagramInformation(user, profile, accessToken, done);
          } else {  // Create a new database record
            return updateInstagramInformation(new models.User(), profile, accessToken, done);
          }
        });

      } else {
        // User is already logged in with another account
        // Retrieve his database record and add the Instagram account
        models.User.findOne({'_id': req.user._id}, function(err, user) {
          if (err)
            return done(err);
          return updateInstagramInformation(user, profile, accessToken, done);
        });   
      }
    });
  }
));

/*
 * Update all Instagram data in 'user' with the information from 'profile' and 'access_token'
 * If anything was changed, save it to the database
 */
function updateInstagramInformation(user, profile, access_token, done) {
  var anythingChanged = false;

  if (user.instagram.id != profile.id) {
    user.instagram.id = profile.id;
    anythingChanged = true;
  }

  if (user.instagram.access_token != access_token) {
    user.instagram.access_token = access_token;               
    anythingChanged = true;
  }
  
  if (user.instagram.name != profile.username) {
    user.instagram.name = profile.username;
    anythingChanged = true;
  }

  var description = profile._json.data.bio;
  if (user.instagram.description != description) {
    user.instagram.description = description;
    anythingChanged = true;
  }

  if (anythingChanged) {
    user.save(function(err) {
      if (err)
        return done(err);
      return done(null, user);
      });
  } else {
    return done(null, user);
  }
}

// Helper functions
function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

