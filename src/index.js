'use strict';

var mongoose = require('mongoose');
var app = require('./app');
var port = 3800;

// Conexion DB
mongoose.Promise = global.Promise;
mongoose
	.connect('mongodb://localhost:27017/curso_mean_social', {
		useNewUrlParser: true,
	})
	.then(() => {
		console.log('La conexión es exitosa ');

		// crear servidor
		app.listen(port, () => {
			console.log('Servidor corriendo en http://localhost:3800');
		});
	})
	.catch((err) => console.log(err));
