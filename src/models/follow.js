'use strict';

const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2');
const Schema = mongoose.Schema;

const FollowSchema = new mongoose.Schema({
	user: { type: Schema.Types.ObjectId, ref: 'User' },
	followed: { type: Schema.Types.ObjectId, ref: 'User' },
});

FollowSchema.plugin(mongoosePaginate);

module.exports = mongoose.model('Follow', FollowSchema);
