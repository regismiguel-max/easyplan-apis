const { authJwt } = require("../../middleware");
const controller = require("../../controllers/corretoras/responsavelDocumento.controller");
const up = require("../../controllers/corretoras/uploadDocumentoResponsavel.controller");


module.exports = (app) => {
    app.use(function (err, req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    app.post(
        "/corretora/responsavel/documento",
        up.upload.single('file'),
        controller.addResponsavelDocumento
    );

    app.get(
        "/corretora/responsavel/documento", [authJwt.verifyToken],
        controller.findAll
    );

    app.get(
        "/corretora/responsavel/documento/:id", [authJwt.verifyToken],
        controller.findResponsavelDocumento
    );

    app.put(
        "/corretora/responsavel/documento/:id", [authJwt.verifyToken],
        up.upload.single('file'),
        controller.updateResponsavelDocumento
    );

    app.delete(
        "/corretora/responsavel/documento/:id", [authJwt.verifyToken, authJwt.isAgentOrAdmin],
        controller.deleteResponsavelDocumento
    );
};