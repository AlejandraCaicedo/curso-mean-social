'use strict';

var path = require('path');
var fs = require('fs');
var moment = require('moment');
var mongoosePaginate = require('mongoose-pagination');

var Publication = require('../models/publication');
var User = require('../models/user');
var Follow = require('../models/follow');

function prrueba(req, res) {
	res.status(200).send({
		message: 'Hola desde controlador de publication',
	});
}

module.exports = {
	prrueba,
};
