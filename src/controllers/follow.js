'use strict';

var User = require('../models/user');
var Follow = require('../models/follow');

function saveFollow(req, res) {
	var params = req.body;
	var follow = new Follow();

	follow.user = req.user.sub;
	follow.followed = params.followed;

	follow.save((err, followStored) => {
		if (err)
			return res.status(500).send({
				message: 'Error al guardar el seguimiento',
			});

		if (!followStored)
			return res.status(404).send({
				message: 'El seguimiento no se ha guardado',
			});

		return res.status(200).send({
			follow: followStored,
		});
	});
}

function deleteFollow(req, res) {
	var userID = req.user.sub; // el que esta logeado
	var followID = req.params.id; // el usuario que se deja de seguir

	Follow.findOneAndDelete(
		{
			user: userID,
			followed: followID,
		},
		(err) => {
			if (err)
				return res.status(500).send({
					message: 'Error al dejar de seguir',
				});

			return res.status(200).send({
				message: 'El follow se ha eliminado',
			});
		},
	);
}

// Listar usuarios que yo sigo
function getFollowingUsers(req, res) {
	var userID = req.user.sub;

	if (req.params.id && req.params.page) {
		userID = req.params.id;
	}

	var page = 1;

	if (req.params.page) {
		page = req.params.page;
	} else {
		page = req.params.id;
	}

	// cantidad de follows por pagina
	var itemsPerPage = 4;

	Follow.find({
		user: userID,
	})
		.populate({
			path: 'followed',
		})
		.paginate(page, itemsPerPage, (err, follows, total) => {
			if (err)
				return res.status(500).send({
					message: 'Error en el servidor',
				});

			if (!follows)
				return res.status(401).send({
					message: 'No hay usuarios seguidos',
				});

			return res.status(200).send({
				total: total, // total de registros que trae el find
				pages: Math.ceil(total / itemsPerPage),
				follows,
			});
		});
}

// Listar usuarios que me siguen
function getFollowedUsers(req, res) {
	var userID = req.user.sub;

	if (req.params.id && req.params.page) {
		userID = req.params.id;
	}

	var page = 1;

	if (req.params.page) {
		page = req.params.page;
	} else {
		page = req.params.id;
	}

	// cantidad de follows por pagina
	var itemsPerPage = 4;

	Follow.find({
		followed: userID,
	})
		.populate('user')
		.paginate(page, itemsPerPage, (err, follows, total) => {
			if (err)
				return res.status(500).send({
					message: 'Error en el servidor',
				});

			if (!follows)
				return res.status(401).send({
					message: 'No hay usuarios seguidores',
				});

			return res.status(200).send({
				total: total, // total de registros que trae el find
				pages: Math.ceil(total / itemsPerPage),
				follows,
			});
		});
}

// devolver usuarios que me siguen sin paginación
function getFollows(req, res) {
	var userID = req.user.sub;

	// sacar los usuarios que sigo
	var find = Follow.find({
		user: userID,
	});

	// sacar los usuarios que me siguen
	if (req.params.followed) {
		find = Follow.find({
			followed: userID,
		});
	}

	find.populate('user followed').exec((err, follows) => {
		if (err)
			return res.status(500).send({
				message: 'Error en el servidor',
			});

		if (!follows)
			return res.status(401).send({
				message: 'No hay usuarios registrados',
			});

		return res.status(200).send({
			follows,
		});
	});
}

module.exports = {
	saveFollow,
	deleteFollow,
	getFollowingUsers,
	getFollowedUsers,
	getFollows,
};
