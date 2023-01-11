'use strict';

var express = require('express');
var bodyParser = require('body-parser');

var app = express();

// CARGAR RUTAS

var user_routes = require('./routers/user');
var follow_routes = require('./routers/follow');

// CARGAR MIDDLEWARES

app.use(
	bodyParser.urlencoded({
		extended: false,
	}),
);
app.use(bodyParser.json());

// CABECERA

// RUTAS

app.use('/api', user_routes);
app.use('/api', follow_routes);

// EXPORTAR LA APP

module.exports = app;
