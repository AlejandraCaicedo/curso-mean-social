'use strict';

const path = require('path');
const fs = require('fs');
const moment = require('moment');

const Publication = require('../models/publication');
const User = require('../models/user');
const Follow = require('../models/follow');

const { removeFilesOfUploads } = require('../services/imageUploadService');

async function savePublication(req, res) {
	const params = req.body;

	if (!params.text) {
		return res.status(400).json({ message: 'You must send a text' });
	}

	const publication = new Publication({
		text: params.text,
		file: null,
		user: req.user.sub,
		created_at: moment().unix(),
	});

	try {
		const publicationStored = await publication.save();

		if (!publicationStored) {
			return res
				.status(404)
				.json({ message: 'The publication has not been saved.' });
		}

		return res.status(200).json({ publication: publicationStored });
	} catch (err) {
		return res
			.status(500)
			.json({ message: 'Error saving the publication.', error: err.message });
	}
}

/**
 * Returning publications from users followed
 * @param {*} req
 * @param {*} res
 */
async function getPublications(req, res) {
	let page = req.params.page ? parseInt(req.params.page) : 1;
	let userId = req.user.sub;
	let itemsPerPage = 4;

	try {
		// Obtener los usuarios que el usuario actual sigue
		let follows = await Follow.find({ user: userId })
			.populate('followed')
			.exec();

		// Extraer los IDs de los usuarios seguidos
		let followsClean = follows.map((follow) => follow.followed._id);

		// Obtener las publicaciones de los usuarios seguidos
		let options = {
			page: page,
			limit: itemsPerPage,
			sort: '-created_at',
			populate: 'user',
		};

		let result = await Publication.paginate(
			{ user: { $in: followsClean } },
			options,
		);

		if (!result.docs.length) {
			return res.status(404).json({ message: 'There are no publications.' });
		}

		return res.status(200).json({
			total_items: result.totalDocs,
			page: result.page,
			pages: result.totalPages,
			publications: result.docs,
		});
	} catch (err) {
		return res
			.status(500)
			.json({ message: 'Error getting publications.', error: err.message });
	}
}

/**
 * Returning a publication giving the ID
 * @param {*} req
 * @param {*} res
 */
async function getPublication(req, res) {
	const publicationId = req.params.id;

	try {
		const publication = await Publication.findById(publicationId);

		if (!publication) {
			return res
				.status(404)
				.json({ message: 'The publication does not exist.' });
		}

		return res.status(200).json({ publication });
	} catch (err) {
		return res
			.status(500)
			.json({ message: 'Error returning publication.', error: err.message });
	}
}

/**
 * Deleting a publication
 * @param {*} req
 * @param {*} res
 */
async function deletePublication(req, res) {
	const publicationId = req.params.id;
	const userId = req.user.sub;

	try {
		const publicationRemoved = await Publication.findOneAndRemove({
			user: userId,
			_id: publicationId,
		});

		if (!publicationRemoved) {
			return res
				.status(404)
				.json({ message: 'The publication could not be deleted.' });
		}

		return res.status(200).json({ publication: publicationRemoved });
	} catch (err) {
		return res
			.status(500)
			.json({ message: 'Error deleting publication.', error: err.message });
	}
}

async function uploadPublicationImage(req, res) {
	const publicationID = req.params.id;
	const userID = req.user.sub;

	if (!req.files || !req.files.image) {
		return res.status(400).json({ message: 'No file was uploaded.' });
	}

	const { path: filePath } = req.files.image;
	const fileName = path.basename(filePath);
	const fileExt = path.extname(fileName).slice(1).toLowerCase();

	const validExtensions = ['png', 'jpg', 'jpeg', 'gif'];
	if (!validExtensions.includes(fileExt)) {
		return removeFilesOfUploads(res, filePath, 'Invalid extension.');
	}

	try {
		const publication = await Publication.findOne({
			user: userID,
			_id: publicationID,
		});

		if (!publication) {
			return removeFilesOfUploads(
				res,
				filePath,
				'No permission to update data.',
			);
		}

		const publicationUpdated = await Publication.findByIdAndUpdate(
			publicationID,
			{ file: fileName },
			{ new: true },
		);

		if (!publicationUpdated) {
			return res.status(404).json({ message: 'Could not upload the image.' });
		}

		return res.status(200).json({ publication: publicationUpdated });
	} catch (err) {
		return res
			.status(500)
			.json({ message: 'Error while uploading the file.', error: err.message });
	}
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
