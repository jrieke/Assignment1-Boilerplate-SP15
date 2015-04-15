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
var models = require('./models');
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
    // req.flash('connection_sequence_finished', true);
    return next(); 
  } else {
    // TODO: Handle situation if no account is connected
    // req.flash('state_connection_sequence', 'started');
    // res.render('not_logged_in');
    res.redirect('/connect');
  }
}

// app.get('/connect', ensureAuthenticated, function(req, res) {
//   if (req.user.facebook && req.user.instagram) {
//     // TODO: Get description
//     res.render('all_connected', {facebook: req.user.facebook, instagram: req.user.instagram});
//   } else if (req.user.facebook) {
//     res.render('facebook_connected', {facebook: facebook});
//   } else if (req.user.instagram) {
//     res.render('instagram_connected', {instagram: instagram});
//   }
// });

app.get('/accounts', ensureAuthenticated, function(req, res) {
  var params = {};
  if (req.user) {
    params = {facebook: req.user.facebook, instagram: req.user.instagram};
  }
  res.render('accounts', params);
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

  if (user.instagram) {
    // console.log("getting instagram");
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
      
  

  if (user.facebook) {
    Facebook.get('/me/photos?access_token=' + user.facebook.access_token, 
      function(err, response) {
        //TODO: Handle error
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
            tempJSON.timestamp = date.getTime();
            // console.log(date.getDay() + "." + date.getMonth() + "." + date.getYear());
            tempJSON.day = date.getDate();
            tempJSON.month = date.getMonth() + 1;
            tempJSON.year = date.getFullYear();
            imageArr.push(tempJSON);

          // }
        }

        async_finished();
    });
  } else {
    async_finished();
  }

});


app.get('/connect', function(req, res) {
  console.log("Got call to connect");
  if (!req.isAuthenticated()) {
    res.render('not_logged_in');
  } else {

    var facebook, instagram;

    var async_finished = _.after(2, function() {
      console.log("Rendering, this is the user:");
      console.log(req.user);
      if (facebook && instagram)
        res.render('all_connected', {facebook: facebook, instagram: instagram});
      else if (facebook)
        res.render('facebook_connected', {facebook: facebook});
      else if (instagram)
        res.render('instagram_connected', {instagram: instagram});
      });

    if (req.user.facebook) {
      facebook = {
        name: req.user.facebook.name
      };    

      Facebook.get('/me?fields=age_range,gender&access_token=' + req.user.facebook.access_token,
        function(err, response) {
          // console.log("got user data from FB:");
          // console.log(response);
          var description = '';
          if (response.gender)
            description += capitalizeFirstLetter(response.gender) + ', ';
          if (response.age_range) 
            description += response.age_range.min + '+ years old';
          facebook.description = description;
          async_finished();
        });
    } else {
      async_finished();
    }

    if (req.user.instagram) {
      instagram = {
        name: req.user.instagram.name
      };

      Instagram.users.info({
        user_id: req.user.instagram.id,
        complete: function(data) {
            // console.log("got user data from Instagram:");
            // console.log(data);
            instagram.description = data.bio;
            async_finished();
          }
        });
    } else {
      async_finished();
    }
  }
  
});



app.get('/auth/instagram',
  auth.passport.authenticate('instagram'));

app.get('/auth/instagram/callback', 
  auth.passport.authenticate('instagram', {successRedirect: 'back', failureRedirect: '/accounts'}));

app.get('/auth/facebook',
  auth.passport.authenticate('facebook', {scope: ['user_photos'] }));

// TODO: Redirect to error page on failureRedirect
app.get('/auth/facebook/callback',
  auth.passport.authenticate('facebook', {successRedirect: 'back', failureRedirect: '/accounts'}));


// TODO: Where to redirect?
app.get('/disconnect', function(req, res) {
  req.logout();
  res.redirect('/connect');
});


http.createServer(app).listen(app.get('port'), function() {
    console.log('Express server listening on port ' + app.get('port'));
});

// Helper functions
function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}
