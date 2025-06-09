const { authJwt } = require("../../middleware");
const controller = require("../../controllers/corretoras-commissions/loteCommissions.controller");
const up = require("../../controllers/corretoras-commissions/uploadCommissionLoteCommissions.controller");

module.exports = (app) => {
    app.use(function (req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    app.post(
        "/corretora/commissions", [authJwt.verifyToken],
        up.upload.single('file'),
        controller.addLoteCommissions
    );

    app.post(
        "/corretora/digital", [authJwt.verifyToken],
        controller.addLoteCommissionsDigital
    );

    app.post(
        "/corretora/commissions/search",
        controller.findLoteCommissionsSearch
    );

    app.get(
        "/corretora/commissions/all",
        controller.findAll
    );

    app.get(
        "/corretora/commissions/:id",
        controller.findLoteCommissions
    );

    app.get(
        "/corretora/commissions/:id/commission",
        controller.findLoteCommissionsCommission
    );

    app.get(
        "/corretora/commissions/notification/:id", [authJwt.verifyToken],
        controller.findLoteCommissionsNotification
    );

    app.put(
        "/corretora/commissions/:id", [authJwt.verifyToken],
        controller.updateLoteCommissions
    );

    app.delete(
        "/corretora/commissions/:id", [authJwt.verifyToken],
        controller.deleteLoteCommissions
    );
};