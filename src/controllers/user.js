'use strict';

var bcrypt = require('bcrypt');
var mongoosePaginate = require('mongoose-pagination');
var fs = require('fs');
var path = require('path');

const User = require('../models/user');
const Follow = require('../models/follow');
const Publication = require('../models/publication');

const jwt = require('../services/jwt');
const { removeFilesOfUploads } = require('../services/imageUploadService');

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
function getUsers(req, res) {
	//usuario identificado
	var identity_user_id = req.user.sub;
	var page = 1;

	if (req.params.page) {
		page = req.params.page;
	}

	// cantidad de usuarios por pagina
	var itemPerPage = 5;

	User.find()
		.sort('_id')
		.paginate(page, itemPerPage, (err, users, total) => {
			if (err)
				return res.status(500).send({
					message: 'Error en la petición',
				});

			if (!users)
				return res.status(404).send({
					message: 'No se encontraron usuarios disponibles',
				});

			followUsersIDs(identity_user_id).then((value) => {
				// total (total de documentos encontrados)
				return res.status(200).send({
					users,
					// usuarios que sigue
					usersFollowing: value.following,
					// usuarios que lo siguen
					usersFollowed: value.followed,
					total,
					pages: Math.ceil(total / itemPerPage),
				});
			});
		});
}

// actualizar datos de usuario
function updateUser(req, res) {
	var userID = req.params.id;
	var update = req.body;

	// eliminar propiedad password del update
	delete update.password;

	if (userID !== req.user.sub) {
		return res.status(500).send({
			message: 'No existen permisos para actualizar los datos del usuario',
		});
	}

	// new: true (devolver el objeto actualizado)

	User.findByIdAndUpdate(
		userID,
		update,
		{
			new: true,
		},
		(err, userUpdate) => {
			if (err)
				return res.status(500).send({
					message: 'Error en la petición',
				});

			if (!userUpdate)
				return res.status(404).send({
					message: 'No se ha podido actualizar el usuario',
				});

			return res.status(200).send({
				user: userUpdate,
			});
		},
	);
}

// contadores de usuarios que sigo y me siguen
function getCounters(req, res) {
	// usuario que esta autenticado
	var identity_user_id = req.user.sub;

	if (req.params.id) {
		//usuario que llega como parametro
		identity_user_id = req.params.id;
	}

	getCountFollow(identity_user_id).then((value) => {
		return res.status(200).send(value);
	});
}

// subir imagen avatar usuario
function uploadImage(req, res) {
	const userID = req.params.id;

	if (!req.files || !req.files.image) {
		return res.status(400).send({ message: 'No file was uploaded.' });
	}

	const { path: filePath } = req.files.image;
	const fileName = path.basename(filePath);
	const fileExt = path.extname(fileName).slice(1).toLowerCase();

	if (userID !== req.user.sub) {
		return removeFilesOfUploads(res, filePath, 'No permission to update data.');
	}

	const validExtensions = ['png', 'jpg', 'jpeg', 'gif'];
	if (!validExtensions.includes(fileExt)) {
		return removeFilesOfUploads(res, filePath, 'Invalid extension.');
	}

	// Actualizar usuario en la base de datos
	User.findByIdAndUpdate(
		userID,
		{ image: fileName },
		{ new: true },
		(err, userUpdated) => {
			if (err) {
				return res.status(500).send({ message: 'Error in the request.' });
			}

			if (!userUpdated) {
				return res.status(404).send({ message: 'Could not upload the image.' });
			}

			return res.status(200).send({ user: userUpdated });
		},
	);
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
	// array de usuarios que sigue el usuario autenticado
	var following = await Follow.find({
		user: userID,
	})
		.select({ _id: 0, __v: 0, user: 0 })
		.exec()
		.then((follows) => {
			return follows;
		})
		.catch((err) => {
			return handleError(err);
		});

	// proceso followind IDs
	var followingClean = [];
	following.forEach((follow) => {
		followingClean.push(follow.followed);
	});

	// array de usuarios que siguen al usuario autenticado
	var followed = await Follow.find({
		followed: userID,
	})
		.select({ _id: 0, __v: 0, followed: 0 })
		.exec()
		.then((follows) => {
			return follows;
		})
		.catch((err) => {
			return handleError(err);
		});

	// proceso followed IDs
	var followedClean = [];
	followed.forEach((follow) => {
		followedClean.push(follow.user);
	});

	return {
		following: followingClean,
		followed: followedClean,
	};
}

module.exports = {
	home,
	saveUser,
	loginUser,
	getUser,
	getUsers,
	updateUser,
	getCounters,
	uploadImage,
	getImageFile,
};
