'use strict';

const express = require('express');
const bodyParser = require('body-parser');

const app = express();

// CARGAR RUTAS

const user_routes = require('./routers/user');
const follow_routes = require('./routers/follow');
const publication_routes = require('./routers/publication');

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
app.use('/api', publication_routes);

// EXPORTAR LA APP

module.exports = app;
