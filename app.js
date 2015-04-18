var express = require('express');
var http = require('http');
var path = require('path');
var handlebars = require('express-handlebars');
var bodyParser = require('body-parser');
var session = require('express-session');
var cookieParser = require('cookie-parser');
var mongoose = require('mongoose');
var _ = require('lodash');
var app = express();

var auth = require('./auth');
var Instagram = auth.Instagram;
var Facebook = auth.Facebook;

// Connect to database
mongoose.connect(process.env.mongodb_connection_url);
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function (callback) {
  console.log("Database connected succesfully.");
});


// Express app configuration
app.engine('handlebars', handlebars({defaultLayout: 'layout'}));
app.set('view engine', 'handlebars');
// app.set('views', __dirname + '/views');
// app.set('partials', path.join(__dirname, 'views', 'partials'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(session({ secret: 'keyboard cat',
                  saveUninitialized: true,
                  resave: true}));
app.use(auth.passport.initialize());
app.use(auth.passport.session());

//set environment ports and start application
app.set('port', process.env.PORT || 3000);

/*
 * Route middleware that redirects to /connect if the user is not logged in
 */
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next(); 
  } else {
    res.redirect('/connect');
  }
}


/*
 * Show different login views depending on which accounts the user has already connected
 * The user will stay on this route until he has connected at least one account
 */
app.get('/connect', function(req, res) {
  if (!req.isAuthenticated()) {
    res.render('not_connected');
  } else {
    if (req.user.facebook && req.user.instagram)
      res.render('completely_connected', {facebook: req.user.facebook, instagram: req.user.instagram});
    else  // only one of Facebook and Instagram
      res.render('partially_connected', {facebook: req.user.facebook, instagram: req.user.instagram});
  }  
});


/*
 * Disconnect all user accounts and redirect to /connect
 */
app.get('/disconnect', function(req, res) {
  req.logout();
  res.redirect('/connect');
});


/*
 * Show an overview of the connected accounts plus the possibility to connect new ones or disconnect at all
 */
app.get('/accounts', ensureAuthenticated, function(req, res) {
  res.render('accounts', {facebook: req.user.facebook, instagram: req.user.instagram});
});


/*
 * Main route
 * Get photos from the user's Facebook and Instagram accounts, filter the ones where he is tagged on
 * and show them (with some metadata) in a grid
 */
app.get('/', ensureAuthenticated, function(req, res) {
  var imageArr = [];

  // Render the page after the two asynchronous API calls have finished
  var async_finished = _.after(2, function() {
      if (imageArr.length === 0) {
        res.render('no_photos');
      } else {
        // Sort the images chronologically
        imageArr.sort(function(a, b) {
          return b.timestamp - a.timestamp;
        });
        res.render('photos', {photos: imageArr});            
      }
    });

  if (req.user.instagram) {
    // Get photos from Instagram
    Instagram.users.self({
      access_token: req.user.instagram.access_token,
      complete: function(data) {
        for (var i = 0; i < data.length; i++) {
          var item = data[i];

          // Get all the users that were tagged on this photo
          var user_ids = item.users_in_photo.map(function(user_item) {
            return user_item.user.id;
          });

          if (user_ids.indexOf(req.user.instagram.id) != -1) {
            // Current user is tagged on this photo
            // Get some metadata about the photo and save it all to 'imageArr'
            var tempJSON = {};
            tempJSON.image_url = item.images.low_resolution.url;
            tempJSON.link = item.link;
            tempJSON.provider = 'Instagram';

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
    // Get photos from Facebook
    // These are already the ones where the user was tagged on, so we do not need to filter
    Facebook.get('/me/photos?access_token=' + req.user.facebook.access_token, 
      function(err, response) {
        for (var i = 0; i < response.data.length; i++) {
          var item = response.data[i];

          // Get some metadata about the photo and save it all to 'imageArr'
          var tempJSON = {};
          tempJSON.image_url = item.source;
          tempJSON.link = item.link;
          tempJSON.provider = 'Facebook';

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


/*
 * Simple error page with a button that redirects to /
 */
app.get('/error', function(req, res) {
  res.render('error');
});


/*
 * Routes for Instagram and Facebook authentication
 */
app.get('/auth/instagram',
  auth.passport.authenticate('instagram'));

app.get('/auth/instagram/callback', 
  auth.passport.authenticate('instagram', {successRedirect: 'back', failureRedirect: '/error'}));

app.get('/auth/facebook',
  auth.passport.authenticate('facebook', {scope: ['user_photos'] }));

app.get('/auth/facebook/callback',
  auth.passport.authenticate('facebook', {successRedirect: 'back', failureRedirect: '/error'}));


// Start the server and go
http.createServer(app).listen(app.get('port'), function() {
    console.log('Express server listening on port ' + app.get('port'));
});
