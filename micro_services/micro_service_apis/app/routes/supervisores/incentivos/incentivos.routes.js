module.exports = (app) => {
    const IncentiveController = require('../../../controllers/supervisores/incentivos-comerciais/incentivos-comerciais-supervisores.controller');
    const { authJwt } = require("../../../middleware");

    app.get("/supervisor/corretoras", IncentiveController.getAllCorretorasByName);
    app.post("/supervisor/incentivo", [authJwt.verifyToken] , IncentiveController.save);
    app.get("/supervisor/incentivos", [authJwt.verifyToken] , IncentiveController.getAll);
    app.get("/supervisor/incentivo", [authJwt.verifyToken] , IncentiveController.getById);
    app.put("/supervisor/incentivo", [authJwt.verifyToken] , IncentiveController.update);
    app.delete("/supervisor/incentivo", [authJwt.verifyToken] , IncentiveController.delete);
};
