'use strict';

var bcrypt = require('bcrypt-nodejs');
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

function saveUser(req, res) {
	var params = req.body;
	var user = new User();

	if (
		params.name &&
		params.surname &&
		params.nick &&
		params.email &&
		params.password
	) {
		user.name = params.name;
		user.surname = params.surname;
		user.nick = params.nick;
		user.email = params.email;
		user.role = 'ROLE_USER';
		user.image = null;

		// restricción de usuarios duplicados
		User.find({
			$or: [
				{
					email: user.email.toLowerCase(),
				},
				{
					nick: user.nick.toLowerCase(),
				},
			],
		}).exec((err, users) => {
			if (err)
				return res.status(500).send({
					message: 'Error en la petición de usuarios',
				});

			if (users && users.length > 0) {
				return res.status(200).send({
					message: 'Ya existe un usuario registrado con esas clausulas',
				});
			}

			// encriptación del password
			bcrypt.hash(params.password, null, null, (err, hash) => {
				user.password = hash;

				user.save((err, userStored) => {
					if (err)
						return res.status(500).send({
							message: 'Error al guardar al usuario',
						});

					if (userStored) {
						res.status(200).send({
							user: userStored,
						});
					} else {
						res.status(404).send({
							message: 'No se podido registrar el usuario',
						});
					}
				});
			});
		});
	} else {
		res.status(200).send({
			message: 'Se deben llenar todos los campos necesarios',
		});
	}
}

function loginUser(req, res) {
	var params = req.body;
	var email = params.email;
	var password = params.password;

	User.findOne(
		{
			email: email,
		},
		(err, user) => {
			if (err)
				return res.status(500).send({
					message: 'Error en la petición',
				});

			if (user) {
				// password que esta en el form y user.password es la de DB
				bcrypt.compare(password, user.password, (err, check) => {
					if (check) {
						if (params.getToken) {
							//generar y devolver token

							return res.status(200).send({
								token: jwt.createToken(user),
							});
						} else {
							//devolver datos de usuario

							//quitar del json el password del usuario
							user.password = undefined;

							return res.status(200).send({
								user,
							});
						}
					} else {
						return res.status(404).send({
							message: 'El usuario no se ha podido identificar',
						});
					}
				});
			} else {
				return res.status(404).send({
					message: 'No existe un usuario registrado con esas clausulas',
				});
			}
		},
	);
}

// obtener datos de un usuario
function getUser(req, res) {
	// usuario de la url
	var userID = req.params.id;

	User.findById(userID, (err, user) => {
		if (err)
			return res.status(500).send({
				message: 'Error en la petición',
			});

		if (!user)
			return res.status(404).send({
				message: 'El usuario no está registrado',
			});

		followThisUser(req.user.sub, userID).then((value) => {
			user.password = undefined;
			return res.status(200).send({
				user,
				following: value.following,
				followed: value.followed,
			});
		});
	});
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
	// sincrona sigo a ese usuario
	// el usuario identificado sigue al usuario que llega en la url
	var following = await Follow.findOne({
		user: identity_user_id,
		followed: userID,
	})
		.exec()
		.then((follow) => {
			return follow;
		})
		.catch((err) => {
			return handleError(err);
		});

	// sincrona usuario seguido me sigue
	var followed = await Follow.findOne({
		user: userID,
		followed: identity_user_id,
	})
		.exec()
		.then((follow) => {
			return follow;
		})
		.catch((err) => {
			return handleError(err);
		});

	return {
		following: following,
		followed: followed,
	};
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
