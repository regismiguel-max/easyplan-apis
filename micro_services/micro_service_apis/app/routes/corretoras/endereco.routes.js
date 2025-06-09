const { authJwt } = require("../../middleware");
const controller = require("../../controllers/corretoras/endereco.controller");


module.exports = (app) => {
    app.use(function (err, req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    app.post(
        "/corretora/endereco",
        controller.addEndereco
    );

    app.get(
        "/corretora/endereco", [authJwt.verifyToken],
        controller.findAll
    );

    app.get(
        "/corretora/endereco/:id", [authJwt.verifyToken, authJwt.isAgentOrAdmin],
        controller.findEndereco
    );

    app.put(
        "/corretora/endereco/:id", [authJwt.verifyToken, authJwt.isAdmin],
        controller.updateEndereco
    );

    app.delete(
        "/corretora/endereco/:id", [authJwt.verifyToken, authJwt.isAdmin],
        controller.deleteEndereco
    );
};