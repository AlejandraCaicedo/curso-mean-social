'use strict';

var path = require('path');
var fs = require('fs');
var moment = require('moment');
var mongoosePaginate = require('mongoose-pagination');
const { publicDecrypt } = require('crypto');

const Publication = require('../models/publication');
const User = require('../models/user');
const Follow = require('../models/follow');

const { removeFilesOfUploads } = require('../services/imageUploadService');
const publication = require('../models/publication');

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

/**
 * Returning publications from users followed
 * @param {*} req
 * @param {*} res
 */
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
/**
 * Returning a publication giving the ID
 * @param {*} req
 * @param {*} res
 */
function getPublication(req, res) {
	const publication = req.params.id;

	Publication.findById(publication, (err, publication) => {
		if (err)
			return res.status(500).send({
				message: 'Error returning publication.',
			});

		if (!publication)
			return res.status(404).send({
				message: 'The publication does not exist.',
			});

		return res.status(200).send({
			publication,
		});
	});
}

/**
 * Deleting a publication
 * @param {*} req
 * @param {*} res
 */
function deletePublication(req, res) {
	const publication = req.params.id;
	const user = req.user.sub;

	Publication.findOneAndRemove(
		{ user: user, _id: publication },
		(err, publicationRemoved) => {
			if (err)
				return res.status(500).send({
					message: 'Error deleting publication.',
				});

			if (!publicationRemoved)
				return res.status(404).send({
					message: 'The publication could not be deleted.',
				});

			return res.status(200).send({
				publication: publicationRemoved,
			});
		},
	);
}

function uploadPublicationImage(req, res) {
	const publicationID = req.params.id;
	const user = req.user.sub;

	if (!req.files || !req.files.image) {
		return res.status(400).send({ message: 'No file was uploaded.' });
	}

	const { path: filePath } = req.files.image;
	const fileName = path.basename(filePath);
	const fileExt = path.extname(fileName).slice(1).toLowerCase();

	const validExtensions = ['png', 'jpg', 'jpeg', 'gif'];
	if (!validExtensions.includes(fileExt)) {
		return removeFilesOfUploads(res, filePath, 'Invalid extension.');
	}

	Publication.findOne({ user, _id: publicationID }, (err, publication) => {
		if (err) {
			return res
				.status(500)
				.send({ message: 'Error while uploading the file.' });
		}

		if (!publication) {
			return removeFilesOfUploads(
				res,
				filePath,
				'No permission to update data.',
			);
		}

		// Actualizar publicación en la base de datos
		Publication.findByIdAndUpdate(
			publicationID,
			{ file: fileName },
			{ new: true },
			(err, publicationUpdated) => {
				if (err) {
					return res.status(500).send({ message: 'Error in the request.' });
				}

				if (!publicationUpdated) {
					return res
						.status(404)
						.send({ message: 'Could not upload the image.' });
				}

				return res.status(200).send({ publication: publicationUpdated });
			},
		);
	});
}

function getImageFile(req, res) {
	const imageFile = req.params.imageFile;
	const pathFile = path.join(__dirname, 'uploads', 'publications', imageFile);

	fs.access(pathFile, fs.constants.F_OK, (err) => {
		if (!err) {
			res.sendFile(path.resolve(pathFile));
		} else {
			res.status(404).send({
				message: 'There is no wanted image.',
			});
		}
	});
}

module.exports = {
	savePublication,
	getPublications,
	getPublication,
	deletePublication,
	uploadPublicationImage,
	getImageFile,
};
