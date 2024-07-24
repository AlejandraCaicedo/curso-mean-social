'use strict';

const express = require('express');
const UserController = require('../controllers/user');

const api = express.Router();
const md_auth = require('../middlewares/authenticated');

const multipart = require('connect-multiparty');
const md_upload = multipart({ uploadDit: './uploads/users' });

api.get('/home', UserController.home);

api.post('/register', UserController.saveUser);

api.post('/login', UserController.loginUser);

api.get('/user/:id', md_auth.ensureAuth, UserController.getUser);

api.get('/users/:page?', md_auth.ensureAuth, UserController.getUsers);

api.get('/counters/:id?', md_auth.ensureAuth, UserController.getCounters);

api.put('/update-user/:id', md_auth.ensureAuth, UserController.updateUser);

api.post(
	'/upload-image-user/:id',
	[md_auth.ensureAuth, md_upload],
	UserController.uploadImageUser,
);

api.get(
	'/get-image-user/:imageFile',
	md_auth.ensureAuth,
	UserController.getImageFile,
);

module.exports = api;
