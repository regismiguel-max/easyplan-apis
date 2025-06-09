const { verifyAuth } = require("../../middleware");
const controller = require("../../controllers/clientes/user.controller");

module.exports = function (app) {
    app.use(function (req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    app.post(
        "/cliente/user", [verifyAuth.verifyToken],
        controller.addUser
    );

    app.post(
        "/cliente/users", [verifyAuth.verifyToken],
        controller.addUsers
    );

    app.post(
        "/cliente/migration-firebase", [verifyAuth.verifyToken],
        controller.addUsersFirebase
    );

    app.get(
        "/cliente/users", [verifyAuth.verifyToken],
        controller.findUsers
    );

    app.get(
        "/cliente/user/:documento", [verifyAuth.verifyToken],
        controller.findUser
    );

    app.put(
        "/cliente/user/:documento", [verifyAuth.verifyToken],
        controller.updateUser
    );

    app.put(
        "/cliente/user/password/:documento", [verifyAuth.verifyToken],
        controller.updatePasswordUser
    );

    app.delete(
        "/cliente/user/:id", [verifyAuth.verifyToken],
        controller.deleteUser
    );
};