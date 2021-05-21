'use strict'

var bcrypt = require('bcrypt-nodejs')
var mongoosePaginate = require('mongoose-pagination')
var fs = require('fs')
var path = require('path')

var User = require('../models/user')
var Follow = require('../models/follow')
var jwt = require('../services/jwt')
const follow = require('../models/follow')

function home(req, res) {
    res.status(200).send({
        message: 'metodo home'
    })
}

function saveUser(req, res) {
    var params = req.body
    var user = new User()

    if (params.name && params.surname && params.nick && params.email && params.password) {
        user.name = params.name
        user.surname = params.surname
        user.nick = params.nick
        user.email = params.email
        user.role = 'ROLE_USER'
        user.image = null

        // restricción de usuarios duplicados
        User.find({
            $or: [{
                email: user.email.toLowerCase()
            },
            {
                nick: user.nick.toLowerCase()
            }
            ]
        }).exec((err, users) => {

            if (err) return res.status(500).send({
                message: 'Error en la petición de usuarios'
            })

            if (users && users.length > 0) {
                return res.status(200).send({
                    message: 'Ya existe un usuario registrado con esas clausulas'
                })
            }

            // encriptación del password
            bcrypt.hash(params.password, null, null, (err, hash) => {

                user.password = hash

                user.save((err, userStored) => {

                    if (err) return res.status(500).send({
                        message: 'Error al guardar al usuario'
                    })

                    if (userStored) {
                        res.status(200).send({
                            user: userStored
                        })
                    } else {
                        res.status(404).send({
                            message: 'No se podido registrar el usuario'
                        })
                    }
                })
            })
        })
    } else {
        res.status(200).send({
            message: 'Se deben llenar todos los campos necesarios'
        })
    }
}

function loginUser(req, res) {
    var params = req.body
    var email = params.email
    var password = params.password

    User.findOne({
        email: email,
    }, (err, user) => {
        if (err) return res.status(500).send({
            message: 'Error en la petición'
        })

        if (user) {
            // password que esta en el form y user.password es la de DB
            bcrypt.compare(password, user.password, (err, check) => {
                if (check) {

                    if (params.getToken) {
                        //generar y devolver token

                        return res.status(200).send({
                            token: jwt.createToken(user)
                        })

                    } else {
                        //devolver datos de usuario

                        //quitar del json el password del usuario
                        user.password = undefined

                        return res.status(200).send({
                            user
                        })
                    }
                } else {
                    return res.status(404).send({
                        message: 'El usuario no se ha podido identificar'
                    })
                }
            })
        } else {
            return res.status(404).send({
                message: 'No existe un usuario registrado con esas clausulas'
            })
        }
    })
}

// obtener datos de un usuario
function getUser(req, res) {
    // usuario de la url
    var userID = req.params.id

    User.findById(userID, (err, user) => {
        if (err) return res.status(500).send({
            message: 'Error en la petición'
        })

        if (!user) return res.status(404).send({
            message: 'El usuario no está registrado'
        })

        followThisUser(req.user.sub, userID).then((value) => {
            user.password = undefined
            return res.status(200).send({
                user,
                following: value.following,
                followed: value.followed
            })
        })
    })
}

// asincrona para saber si un usuario sigue a otro
async function followThisUser(identity_user_id, userID) {

    // sincrona sigo a ese usuario
    // el usuario identificado sigue al usuario que llega en la url
    var following = await Follow.findOne({
        user: identity_user_id,
        followed: userID
    }).exec().then((follow) => {
        return follow
    }).catch((err) => {
        return handleError(err)
    })

    // sincrona usuario seguido me sigue
    var followed = await Follow.findOne({
        user: userID,
        followed: identity_user_id
    }).exec().then((follow) => {
        return follow
    }).catch((err) => {
        return handleError(err)
    })

    return {
        following: following,
        followed: followed
    }
}

// obtener listado de usuarios paginados
function getUsers(req, res) {

    //usuario identificado
    var identity_user_id = req.user.sub
    var page = 1

    if (req.params.page) {
        page = req.params.page
    }

    // cantidad de usuarios por pagina
    var itemPerPage = 5

    User.find().sort('_id').paginate(page, itemPerPage, (err, users, total) => {
        if (err) return res.status(500).send({
            message: 'Error en la petición'
        })

        if (!users) return res.status(404).send({
            message: 'No se encontraron usuarios disponibles'
        })

        followUsersIDs(identity_user_id).then((value) => {
            // total (total de documentos encontrados)
            return res.status(200).send({
                users,
                // usuarios que sigue
                usersFollowing: value.following,
                // usuarios que lo siguen
                usersFollowed: value.followed,
                total,
                pages: Math.ceil(total / itemPerPage)
            })
        })
    })
}

// asincrona para saber si un usuario sigue a otro (usuarios paginados)
async function followUsersIDs(userID) {
    // array de usuarios que sigue el usuario autenticado
    var following = await Follow.find({
        user: userID
    }).select({ '_id': 0, '__v': 0, 'user': 0 }).exec().then((follows) => {
        return follows
    }).catch((err) => {
        return handleError(err)
    })

    // proceso followind IDs
    var followingClean = []
    following.forEach((follow) => {
        followingClean.push(follow.followed)
    })

    // array de usuarios que siguen al usuario autenticado
    var followed = await Follow.find({
        followed: userID
    }).select({ '_id': 0, '__v': 0, 'followed': 0 }).exec().then((follows) => {
        return follows
    }).catch((err) => {
        return handleError(err)
    })

    // proceso followed IDs
    var followedClean = []
    followed.forEach((follow) => {
        followedClean.push(follow.user)
    })

    return {
        following: followingClean,
        followed: followedClean
    }
}

// actualizar datos de usuario
function updateUser(req, res) {
    var userID = req.params.id
    var update = req.body

    // eliminar propiedad password del update
    delete update.password

    if (userID != req.user.sub) {
        return res.status(500).send({
            message: 'No existen permisos para actualizar los datos del usuario'
        })
    }

    // new: true (devolver el objeto actualizado)

    User.findByIdAndUpdate(userID, update, {
        new: true
    }, (err, userUpdate) => {
        if (err) return res.status(500).send({
            message: 'Error en la petición'
        })

        if (!userUpdate) return res.status(404).send({
            message: 'No se ha podido actualizar el usuario'
        })

        return res.status(200).send({
            user: userUpdate
        })

    })
}

// subir imagen avatar usuario
function uploadImage(req, res) {
    var userID = req.params.id

    if (req.files) {
        var file_path = req.files.image.path
        console.log('file path: ', file_path)

        var file_split = file_path.split("\/")
        console.log('file split: ', file_split)

        var file_name = file_split[2]
        console.log('file name: ', file_name)

        var ext_split = file_name.split(".")
        console.log('ext: ', ext_split)

        var file_ext = ext_split[1]
        console.log('file ext: ', file_ext)

        if (userID != req.user.sub) {
            return removeFilesOfUploads(res, file_path, 'No existen permisos para actualizar los datos del usuario')
        }

        if (file_ext == 'png' || file_ext == 'jpg' || file_ext == 'jpeg' || file_ext == 'gif') {
            // actualizar usuario en la base de datos

            User.findByIdAndUpdate(userID, {
                image: file_name
            }, {
                new: true
            }, (err, userUpdate) => {
                if (err) return res.status(500).send({
                    message: 'Error en la petición'
                })

                if (!userUpdate) return res.status(404).send({
                    message: 'No se ha podido actualizar la imagen del usuario'
                })

                return res.status(200).send({
                    user: userUpdate
                })
            })
        } else {
            return removeFilesOfUploads(res, file_path, 'Extensión no válida')
        }
    } else {
        return res.status(200).send({
            message: 'No se subió ningun archivo'
        })
    }
}

function getImageFile(req, res) {
    var image_File = req.params.imageFile
    var path_file = './uploads/users/' + image_File

    fs.exists(path_file, (exists) => {
        if (exists) {
            res.sendFile(path.resolve(path_file))
        } else {
            res.status(200).send({
                message: 'No existe la imagen buscada'
            })
        }
    })
}

function removeFilesOfUploads(res, file_path, message) {
    fs.unlink(file_path, (err) => {
        return res.status(200).send({
            message: message
        });
    });
}

module.exports = {
    home,
    saveUser,
    loginUser,
    getUser,
    getUsers,
    updateUser,
    uploadImage,
    getImageFile
}