const fs = require('fs');
const path = require('path');

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
};
