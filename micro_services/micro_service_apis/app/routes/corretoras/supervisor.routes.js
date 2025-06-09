const { authJwt } = require("../../middleware");
const controller = require("../../controllers/corretoras/supervisor.controller");


module.exports = (app) => {
    app.use(function (err, req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    app.post(
        "/corretora/supervisor", [authJwt.verifyToken, authJwt.isAgentOrAdmin],
        controller.addSupervisor
    );

    app.get(
        "/corretora/supervisor/all",
        controller.findAll
    );

    app.get(
        "/corretora/supervisor/:id", [authJwt.verifyToken],
        controller.findSupervisor
    );

    app.put(
        "/corretora/supervisor/:id", [authJwt.verifyToken, authJwt.isAgentOrAdmin],
        controller.updateSupervisor
    );

    app.delete(
        "/corretora/supervisor/:id", [authJwt.verifyToken, authJwt.isAgentOrAdmin],
        controller.deleteSupervisor
    );
};