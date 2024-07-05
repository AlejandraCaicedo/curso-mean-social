'use strict';

var path = require('path');
var fs = require('fs');
var moment = require('moment');
var mongoosePaginate = require('mongoose-pagination');

var Publication = require('../models/publication');
var User = require('../models/user');
var Follow = require('../models/follow');
const { publicDecrypt } = require('crypto');

function savePublication(req, res) {
	let params = req.body;

	if (!params.text) {
		return res.status(200).send({ message: 'You must send a text' });
	}

	let publication = new Publication();
	publication.text = params.text;
	publication.file = null;
	publication.user = req.user.sub;
	publication.created_at = moment().unix();

	publication.save((err, publicationStored) => {
		if (err)
			return res.status(500).send({
				message: 'Error saving the publication.',
			});

		if (!publicationStored)
			return res.status(404).send({
				message: 'The publication has not been saved.',
			});

		return res.status(200).send({
			publication: publicationStored,
		});
	});
}

function getPublications(req, res) {
	let page = 1;
	let userId = req.user.sub;

	if (req.params.page) {
		page = req.params.page;
	}

	let itemsPerPage = 4;

	Follow.find({ user: userId })
		.populate({ path: 'followed' })
		.exec((err, follows) => {
			if (err)
				return res.status(500).send({
					message: 'Error getting followed.',
				});

			let followsClean = [];

			follows.forEach((follow) => {
				followsClean.push(follow.followed);
			});

			Publication.find({ user: { $in: followsClean } })
				.sort('-created_at')
				.populate('user')
				.paginate(page, itemsPerPage, (err, publications, total) => {
					if (err)
						return res.status(500).send({
							message: 'Error returning publications.',
						});

					if (!publications)
						return res.status(404).send({
							message: 'There are no publications.',
						});

					return res.status(200).send({
						total_items: total,
						page,
						pages: Math.ceil(total / itemsPerPage),
						publications,
					});
				});
		});
}

module.exports = {
	savePublication,
	getPublications,
};
