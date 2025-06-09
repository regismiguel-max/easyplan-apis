const { authJwt } = require("../../middleware");
const controller = require("../../controllers/apoio_vendas/files.controller");

module.exports = (app) => {
    app.use(function (req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    app.post(
        "/file", [authJwt.verifyToken, authJwt.isAdmin],
        controller.addFile
    );

    app.get(
        "/file",
        controller.findAll
    );

    app.get(
        "/file/:id",
        controller.findFile
    );

    app.put(
        "/file/:id", [authJwt.verifyToken, authJwt.isAdmin],
        controller.updateFile
    );

    app.delete(
        "/file/:id", [authJwt.verifyToken, authJwt.isAdmin],
        controller.deleteFile
    );
};