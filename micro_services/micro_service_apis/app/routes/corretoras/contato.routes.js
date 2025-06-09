const { authJwt } = require("../../middleware");
const controller = require("../../controllers/corretoras/contato.controller");


module.exports = (app) => {
    app.use(function (err, req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    app.post(
        "/corretora/contato",
        controller.addContato
    );

    app.get(
        "/corretora/contato", [authJwt.verifyToken],
        controller.findAll
    );

    app.get(
        "/corretora/contato/:id", [authJwt.verifyToken],
        controller.findContato
    );

    app.put(
        "/corretora/contato/:id", [authJwt.verifyToken],
        controller.updateContato
    );

    app.delete(
        "/corretora/contato/:id", [authJwt.verifyToken, authJwt.isAgentOrAdmin],
        controller.deleteContato
    );
};