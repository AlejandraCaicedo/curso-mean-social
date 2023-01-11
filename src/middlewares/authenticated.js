'use strict';

var jwt = require('jwt-simple');
var moment = require('moment');
var secret = 'clave_secreta';

// req (datos que se reciben en la peticion)
// next (función que permite saltar a otro paso)
exports.ensureAuth = function (req, res, next) {
	if (!req.headers.authorization) {
		return res.status(403).send({
			message: 'La petición no tiene la cabecera de autenticación',
		});
	}

	var token = req.headers.authorization.replace(/['"]+/g, '');

	try {
		//decodificar el payload y sacar los datos del token
		var payload = jwt.decode(token, secret);

		if (payload.exp <= moment().unix()) {
			return res.status(401).send({
				message: 'El token ha expirado',
			});
		}
	} catch (error) {
		return res.status(404).send({
			message: 'El token no es válido',
		});
	}

	req.user = payload;

	next();
};
