'use strict';

const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const UserSchema = new mongoose.Schema({
	name: String,
	surname: String,
	nick: String,
	email: String,
	password: String,
	role: String,
	image: String,
});

UserSchema.plugin(mongoosePaginate);

// exportar el modelo de usuario(nombre del modelo, esquema)
module.exports = mongoose.model('User', UserSchema);
