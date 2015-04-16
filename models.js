var mongoose = require('mongoose');

// Schema for database record of user
var userSchema = mongoose.Schema({
	facebook: {
        id: String,
        name: String,
        description: String,
        access_token: String
    },
    instagram: {
    	id: String,
    	name: String,
        description: String,
    	access_token: String
    }
});

exports.User = mongoose.model('User', userSchema);
