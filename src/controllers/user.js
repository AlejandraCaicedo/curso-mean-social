'use strict';

const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

const User = require('../models/user');
const Follow = require('../models/follow');
const Publication = require('../models/publication');

const jwt = require('../services/jwt');
const {
	removeFilesOfUploads,
	uploadImage,
} = require('../services/imageUploadService');

function home(req, res) {
	res.status(200).send({
		message: 'metodo home',
	});
}

async function saveUser(req, res) {
	const { name, surname, nick, email, password } = req.body;

	if (name && surname && nick && email && password) {
		try {
			const existingUsers = await User.find({
				$or: [{ email: email.toLowerCase() }, { nick: nick.toLowerCase() }],
			});

			if (existingUsers.length > 0) {
				return res.status(400).json({
					message: 'There is already a registered user with these credentials.',
				});
			}

			const user = new User({
				name,
				surname,
				nick,
				email,
				role: 'ROLE_USER',
				image: null,
				password: await bcrypt.hash(password, 10),
			});

			const userStored = await user.save();

			if (userStored) {
				res.status(201).json({ user: userStored });
			} else {
				res.status(400).json({ message: 'Could not register the user.' });
			}
		} catch (err) {
			res
				.status(500)
				.json({ message: 'Error in the request.', error: err.message });
		}
	} else {
		res.status(400).json({ message: 'All necessary fields must be filled.' });
	}
}

async function loginUser(req, res) {
	const { email, password, getToken } = req.body;

	try {
		const user = await User.findOne({ email });

		if (!user) {
			return res.status(404).json({
				message: 'No registered user with those credentials.',
			});
		}

		const isMatch = await bcrypt.compare(password, user.password);

		if (!isMatch) {
			return res
				.status(404)
				.json({ message: 'The password entered is incorrect.' });
		}

		if (getToken) {
			try {
				// generar token
				const token = jwt.createToken(user);
				return res.status(200).json({ token });
			} catch (tokenError) {
				return res.status(500).json({
					message: 'Error when authenticating user.',
					error: tokenError.message,
				});
			}
		} else {
			// quitar contraseña del usuario
			user.password = undefined;
			return res.status(200).json({
				user,
			});
		}
	} catch (err) {
		return res.status(500).json({
			message: 'Error in the request.',
			error: err.message,
		});
	}
}

// obtener datos de un usuario
async function getUser(req, res) {
	try {
		const userID = req.params.id;

		const user = await User.findById(userID);

		if (!user) {
			return res.status(404).json({
				message: 'The user is not registered.',
			});
		}

		const value = await followThisUser(req.user.sub, userID);

		user.password = undefined;

		return res.status(200).json({
			user,
			following: value.following,
			followed: value.followed,
		});
	} catch (err) {
		return res.status(500).json({
			message: 'Error in the request.',
			error: err.message,
		});
	}
}

// obtener listado de usuarios paginados
async function getUsers(req, res) {
	const identity_user_id = req.user.sub;
	const page = req.params.page ? parseInt(req.params.page) : 1;
	const itemPerPage = 5;

	try {
		const options = {
			page,
			limit: itemPerPage,
			sort: '_id',
		};

		const users = await User.paginate({}, options);

		if (!users.docs.length) {
			return res.status(404).json({
				message: 'No users were found.',
			});
		}

		const followInfo = await followUsersIDs(identity_user_id);

		return res.status(200).json({
			users: users.docs,
			usersFollowing: followInfo.following,
			usersFollowed: followInfo.followed,
			total: users.totalDocs,
			pages: users.totalPages,
		});
	} catch (err) {
		return res.status(500).json({
			message: 'Error in the request.',
			error: err.message,
		});
	}
}

// actualizar datos de usuario
async function updateUser(req, res) {
	const userID = req.params.id;
	const update = req.body;

	// Eliminar la propiedad password del objeto update
	delete update.password;

	if (userID !== req.user.sub) {
		return res.status(403).json({
			message: 'You do not have permissions to update user data.',
		});
	}

	try {
		const userUpdated = await User.findByIdAndUpdate(userID, update, {
			new: true,
		});

		if (!userUpdated) {
			return res.status(404).json({
				message: 'Could not update the user.',
			});
		}

		return res.status(200).json({
			user: userUpdated,
		});
	} catch (err) {
		return res.status(500).json({
			message: 'Error in the request.',
			error: err.message,
		});
	}
}

// contadores de usuarios que sigo y me siguen
async function getCounters(req, res) {
	try {
		// Usuario autenticado
		let identity_user_id = req.user.sub;

		// Si se envía un ID de usuario en los parámetros
		if (req.params.id) {
			identity_user_id = req.params.id;
		}

		const counters = await getCountFollow(identity_user_id);

		return res.status(200).json(counters);
	} catch (err) {
		return res.status(500).json({
			message: 'Error in the request.',
			error: err.message,
		});
	}
}

// subir imagen avatar usuario
async function uploadImageUser(req, res) {
	const userID = req.params.id;
	return uploadImage(req, res, 'user', userID, req.user.sub);
}

function getImageFile(req, res) {
	const imageFile = req.params.imageFile;
	const pathFile = path.join(__dirname, 'uploads', 'users', imageFile);

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

// asincrona para saber si un usuario sigue a otro
async function followThisUser(identity_user_id, userID) {
	try {
		// Buscar si el usuario identificado sigue al usuario especificado
		const following = await Follow.findOne({
			user: identity_user_id,
			followed: userID,
		}).exec();

		// Buscar si el usuario especificado sigue al usuario identificado
		const followed = await Follow.findOne({
			user: userID,
			followed: identity_user_id,
		}).exec();

		return {
			following,
			followed,
		};
	} catch (err) {
		throw new Error('Error while getting user following.');
	}
}

// asincrona para contar cuantos seguidos y seguidores tiene un usuario
async function getCountFollow(userID) {
	try {
		const [following, followed, publications] = await Promise.all([
			Follow.count({ user: userID }).exec(),
			Follow.count({ followed: userID }).exec(),
			Publication.count({ user: userID }).exec(),
		]);

		return {
			following,
			followed,
			publications,
		};
	} catch (err) {
		handleError(err);
	}
}

// asincrona para saber si un usuario sigue a otro (usuarios paginados)
async function followUsersIDs(userID) {
	try {
		// Obtener usuarios que sigue el usuario autenticado
		const following = await Follow.find({ user: userID })
			.select({ _id: 0, __v: 0, user: 0 })
			.exec();
		const followingClean = following.map((follow) => follow.followed);

		// Obtener usuarios que siguen al usuario autenticado
		const followed = await Follow.find({ followed: userID })
			.select({ _id: 0, __v: 0, followed: 0 })
			.exec();
		const followedClean = followed.map((follow) => follow.user);

		return {
			following: followingClean,
			followed: followedClean,
		};
	} catch (err) {
		throw new Error('Error while getting following IDs');
	}
}

module.exports = {
	home,
	saveUser,
	loginUser,
	getUser,
	getUsers,
	updateUser,
	getCounters,
	uploadImageUser,
	getImageFile,
};
