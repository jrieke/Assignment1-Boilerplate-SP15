var mongoose = require('mongoose');
// var findOrCreate = require('mongoose-findorcreate');

var userSchema = mongoose.Schema({
	facebook: {
        id: String,
        name: String,
        access_token: String
    },
    instagram: {
    	id: String,
    	name: String,
    	access_token: String
    }
});

// userSchema.plugin(findOrCreate);

exports.User = mongoose.model('User', userSchema);

