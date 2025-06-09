const { authJwt } = require("../../../middleware");
const controller = require("../../../controllers/supervisores/apoio_vendas/files.controller");

module.exports = (app) => {
    app.use(function (req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    app.get(
        "/supervisor/salessupport/file", [authJwt.verifyToken],
        controller.findAll
    );

    app.get(
        "/supervisor/salessupport/file/:id", [authJwt.verifyToken],
        controller.findFile
    );
};