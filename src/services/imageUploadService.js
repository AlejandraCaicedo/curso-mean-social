const fs = require('fs');
const path = require('path');

const User = require('../models/user');
const Publication = require('../models/publication');

const validExtensions = ['png', 'jpg', 'jpeg', 'gif'];

async function uploadImage(req, res, type, id, userID) {
	if (!req.files || !req.files.image) {
		return res.status(400).json({ message: 'No file was uploaded.' });
	}

	const { path: filePath } = req.files.image;
	const fileName = path.basename(filePath);
	const fileExt = path.extname(fileName).slice(1).toLowerCase();

	if (!validExtensions.includes(fileExt)) {
		return removeFilesOfUploads(res, filePath, 'Invalid extension.');
	}

	try {
		let updatedItem;
		if (type === 'user') {
			if (id !== userID) {
				return removeFilesOfUploads(
					res,
					filePath,
					'No permission to update data.',
				);
			}

			updatedItem = await User.findByIdAndUpdate(
				id,
				{ image: fileName },
				{ new: true },
			);
		} else if (type === 'publication') {
			const publication = await Publication.findOne({
				user: userID,
				_id: id,
			});

			if (!publication) {
				return removeFilesOfUploads(
					res,
					filePath,
					'No permission to update data.',
				);
			}

			updatedItem = await Publication.findByIdAndUpdate(
				id,
				{ file: fileName },
				{ new: true },
			);
		}

		if (!updatedItem) {
			return res.status(404).json({
				message: `Could not upload the ${type === 'user' ? 'image' : 'file'}.`,
			});
		}

		return res.status(200).json({ [type]: updatedItem });
	} catch (err) {
		return res.status(500).json({
			message: `Error while uploading the ${
				type === 'user' ? 'image' : 'file'
			}.`,
			error: err.message,
		});
	}
}

function removeFilesOfUploads(res, filePath, message) {
	fs.unlink(filePath, (err) => {
		if (err)
			return res
				.status(500)
				.send({ message: 'Error while deleting the file.' });
		return res.status(200).send({ message });
	});
}

module.exports = {
	removeFilesOfUploads,
	uploadImage,
};
