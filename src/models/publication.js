'use strict';

const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');

const PublicationSchema = new mongoose.Schema({
	text: String,
	file: String,
	created_at: String,
	user: { type: Schema.ObjectId, ref: 'User' },
});

PublicationSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('Publication', PublicationSchema);
