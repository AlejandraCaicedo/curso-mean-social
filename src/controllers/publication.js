'use strict';

var path = require('path');
var fs = require('fs');
var moment = require('moment');
var mongoosePaginate = require('mongoose-pagination');

var Publication = require('../models/publication');
var User = require('../models/user');
var Follow = require('../models/follow');
const { publicDecrypt } = require('crypto');

function prrueba(req, res) {
	res.status(200).send({
		message: 'Hola desde controlador de publication',
	});
}

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

module.exports = {
	prrueba,
	savePublication,
};
