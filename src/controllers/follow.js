'use strict';

var User = require('../models/user');
var Follow = require('../models/follow');

async function saveFollow(req, res) {
	try {
		const params = req.body;
		const follow = new Follow({
			user: req.user.sub,
			followed: params.followed,
		});

		const followStored = await follow.save();

		if (!followStored) {
			return res.status(404).json({ message: 'The follow has not been saved' });
		}

		return res.status(200).json({ follow: followStored });
	} catch (err) {
		return res
			.status(500)
			.json({ message: 'Error in the request.', error: err.message });
	}
}

async function deleteFollow(req, res) {
	try {
		const userID = req.user.sub; // Usuario logeado
		const followID = req.params.id; // Usuario a dejar de seguir

		const result = await Follow.findOneAndDelete({
			user: userID,
			followed: followID,
		});

		if (!result) {
			return res.status(404).json({ message: 'No follow to remove found.' });
		}

		return res
			.status(200)
			.json({ message: 'The follow has been successfully removed.' });
	} catch (err) {
		return res
			.status(500)
			.json({ message: 'Error in the request.', error: err.message });
	}
}

// Listar usuarios que yo sigo
async function getFollowingUsers(req, res) {
	try {
		const { id, page } = req.params;
		const userID = id || req.user.sub;
		const currentPage = parseInt(page) || parseInt(id) || 1;
		const itemsPerPage = 4;

		const options = {
			populate: { path: 'followed' },
			page: currentPage,
			limit: itemsPerPage,
		};

		const result = await Follow.paginate({ user: userID }, options);

		if (!result.docs.length) {
			return res.status(401).json({ message: 'There are no users followed.' });
		}

		return res.status(200).json({
			follows: result.docs,
			total: result.totalDocs,
			pages: result.totalPages,
		});
	} catch (err) {
		return res.status(500).json({
			message: 'Error in the request.',
			error: err.message,
		});
	}
}

// Listar usuarios que me siguen
async function getFollowedUsers(req, res) {
	try {
		const { id, page } = req.params;
		const userID = id || req.user.sub;
		const currentPage = parseInt(page) || parseInt(id) || 1;
		const itemsPerPage = 4;

		const options = {
			populate: 'user',
			page: currentPage,
			limit: itemsPerPage,
		};

		const result = await Follow.paginate({ followed: userID }, options);

		if (!result.docs.length) {
			return res
				.status(401)
				.json({ message: 'There are no followers for this user.' });
		}

		return res.status(200).json({
			total: result.totalDocs,
			pages: result.totalPages,
			follows: result.docs,
		});
	} catch (err) {
		return res.status(500).json({
			message: 'Error in the request.',
			error: err.message,
		});
	}
}

// devolver usuarios que me siguen sin paginación
async function getFollows(req, res) {
	try {
		const userID = req.user.sub;
		let findQuery;

		if (req.params.followed) {
			findQuery = Follow.find({ followed: userID });
		} else {
			findQuery = Follow.find({ user: userID });
		}

		const follows = await findQuery.populate('user followed').exec();

		if (!follows || follows.length === 0) {
			return res
				.status(401)
				.json({ message: 'There are no follow for this user.' });
		}

		return res.status(200).json({ follows });
	} catch (err) {
		return res
			.status(500)
			.json({ message: 'Error in the request.', error: err.message });
	}
}

module.exports = {
	saveFollow,
	deleteFollow,
	getFollowingUsers,
	getFollowedUsers,
	getFollows,
};
