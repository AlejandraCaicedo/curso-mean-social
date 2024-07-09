'use strict';

var express = require('express');
var PublicationController = require('../controllers/publication');

var api = express.Router();
var md_auth = require('../middlewares/authenticated');

var multipart = require('connect-multiparty');
var md_upload = multipart({ uploadDit: './uploads/publications' });

api.post(
	'/publication',
	md_auth.ensureAuth,
	PublicationController.savePublication,
);

api.get(
	'/publications/:page?',
	md_auth.ensureAuth,
	PublicationController.getPublications,
);

api.get(
	'/publication/:id',
	md_auth.ensureAuth,
	PublicationController.getPublication,
);

api.delete(
	'/publication/:id',
	md_auth.ensureAuth,
	PublicationController.deletePublication,
);

api.post(
	'/upload-image-post/:id',
	[md_auth.ensureAuth, md_upload],
	PublicationController.uploadPublicationImage,
);

api.get(
	'/get-image-post/:imageFile',
	md_auth.ensureAuth,
	PublicationController.getImageFile,
);

module.exports = api;
