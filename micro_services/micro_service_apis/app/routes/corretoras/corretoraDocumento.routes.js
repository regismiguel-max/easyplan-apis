const { authJwt } = require("../../middleware");
const controller = require("../../controllers/corretoras/corretoraDocumento.controller");
const up = require("../../controllers/corretoras/uploadDocumentoCorretor.controller");


module.exports = (app) => {
    app.use(function (err, req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    app.post(
        "/corretora/documento",
        up.upload.single('file'),
        controller.addCorretoraDocumento
    );

    app.get(
        "/corretora/documento", [authJwt.verifyToken],
        controller.findAll
    );

    app.get(
        "/corretora/documento/:id", [authJwt.verifyToken],
        controller.findCorretoraDocumento
    );

    app.put(
        "/corretora/documento/:id", [authJwt.verifyToken],
        up.upload.single('file'),
        controller.updateCorretoraDocumento
    );

    app.delete(
        "/corretora/documento/:id", [authJwt.verifyToken, authJwt.isAgentOrAdmin],
        controller.deleteCorretoraDocumento
    );
};