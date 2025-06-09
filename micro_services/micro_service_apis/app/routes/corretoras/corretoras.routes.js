const { authJwt, verifyCorretora } = require("../../middleware");
const controller = require("../../controllers/corretoras/corretoras.controller");


module.exports = (app) => {
    app.use(function (err, req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    app.post(
        "/corretora",
        controller.addCorretora
    );

    app.post(
        "/corretora/search", [authJwt.verifyToken, authJwt.isAgentOrAdmin],
        controller.findCorretorasSearch
    );

    app.post(
        "/corretora/estado", [authJwt.verifyToken, authJwt.isAgentOrAdmin],
        controller.findCorretorasEstados
    );

    app.post(
        "/corretora/enderecos", [authJwt.verifyToken, authJwt.isAgentOrAdmin],
        controller.findAllCorretoraEndereco
    );

    app.get(
        "/corretora", [authJwt.verifyToken],
        controller.findAll
    );

    app.get(
        "/corretora/:id", [authJwt.verifyToken],
        controller.findCorretora
    );

    app.get(
        "/corretora/assessoria/all", [authJwt.verifyToken],
        controller.findCorretoraCategoria
    );

    app.get(
        "/corretora/verifycorretora/:cnpj", [verifyCorretora.checkDuplicateCNPJ],
    );

    app.put(
        "/corretora/:id", [authJwt.verifyToken],
        controller.updateCorretora
    );

    app.delete(
        "/corretora/:id", [authJwt.verifyToken, authJwt.isAgentOrAdmin],
        controller.deleteCorretora
    );
};