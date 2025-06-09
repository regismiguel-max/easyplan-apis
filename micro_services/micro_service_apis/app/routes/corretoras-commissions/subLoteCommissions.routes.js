const { authJwt } = require("../../middleware");
const controller = require("../../controllers/corretoras-commissions/subLoteCommissions.controller");

module.exports = (app) => {
    app.use(function (req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    app.post(
        "/corretora/commissions/sub/search",
        controller.findSubLoteCommissionsSearch
    );

    app.post(
        "/corretora/commissions/sub/all/search/",
        controller.findSubLoteCommissionsAllSearch
    );

    app.get(
        "/corretora/commissions/sub/all",
        controller.findAll
    );

    app.get(
        "/corretora/commissions/sub/:id",
        controller.findSubLoteCommissions
    );

    app.get(
        "/corretora/commissions/sub/nfs/:id",
        controller.getSubLoteCommissions
    );

    app.get(
        "/corretora/commissions/sub/:id/commission",
        controller.findSubLoteCommissionsCommission
    );
    app.get(
        "/corretora/commissions/sub/lote/:id",
        controller.findSubLoteCommissionsCommission
    );

    app.get(
        "/corretora/commissions/sub/document/:corretora_CNPJ",
        controller.findSubLoteCommissionsDocument
    );

    app.get(
        "/corretora/commissions/sub/notification/:id", [authJwt.verifyToken],
        controller.findLoteCommissionsNotification
    );

    app.put(
        "/corretora/commissions/sub/:id", [authJwt.verifyToken],
        controller.updateSubLoteCommissions
    );
};