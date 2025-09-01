const { authJwt } = require("../../middleware");
const controller = require("../../controllers/corretoras-commissions/commissions.controller");

module.exports = (app) => {
    app.use(function (req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    app.post(
        "/corretora/commissions/commission", [authJwt.verifyToken],
        controller.addCommission
    );

    app.post(
        "/corretora/commissions/commission/document/search",
        controller.findCommissionDocumentSearch
    );

    app.post(
        "/corretora/commissions/commission/document/name",
        controller.findCommissionDocumentSearchName
    );

    app.get(
        "/corretora/commissions/commission",
        controller.findAll
    );

    app.get(
        "/corretora/commissions/commission/:id",
        controller.findCommission
    );

    app.get(
        "/corretora/commissions/commission/document/:corretora_CNPJ",
        controller.findCommissionDocument
    );

    app.get(
        "/corretora/commissions/commission/digitalsaude/:codigo",
        controller.findCommissionDigitalSaude
    );

    app.post(
        "/corretora/commissions/commission/digitalsaude/search",
        controller.findCommissionDigitalSaude
    );

    app.post(
        "/corretora/commissions/commission/digitalsaude/search-bulk",
        controller.findCommissionDigitalSaudeBulk
    );

    app.put(
        "/corretora/commissions/commission/:id", [authJwt.verifyToken],
        controller.updateCommission
    );

    app.delete(
        "/corretora/commissions/commission/:id", [authJwt.verifyToken],
        controller.deleteCommission
    );
};