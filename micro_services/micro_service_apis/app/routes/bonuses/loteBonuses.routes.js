const { authJwt } = require("../../middleware");
const controller = require("../../controllers/bonuses/loteBonuses.controller");
const produtorTransactions = require("../../controllers/bonuses/produtorTransactionsBonuses.controler");
const up = require("../../controllers/bonuses/uploadBonuseLoteBonuses.controller");

module.exports = (app) => {
    app.use(function (req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    app.post(
        "/loteBonuses",
        up.upload.single('file'),
        controller.addLoteBonuse
    );

    app.post(
        "/loteBonuses/digital",
        controller.addLoteBonuseDigital
    );

    // app.post(
    //     "/loteBonuses/transaction",
    //     produtorTransactions.AddTransaction
    // );

    app.post(
        "/loteBonuses/search",
        controller.findLoteBonusesSearch
    );

    app.get(
        "/loteBonuses",
        controller.findAll
    );

    app.get(
        "/loteBonuses/:id",
        controller.findLoteBonuses
    );

    app.get(
        "/loteBonuses/wallet/availableBalance/:id",
        controller.findLoteBonusesAvailableBalance
    );

    app.get(
        "/loteBonuses/close/:id", [authJwt.verifyToken],
        controller.closeLoteBonuse
    );

    app.put(
        "/loteBonuses/:id", [authJwt.verifyToken],
        controller.updateLoteBonuse
    );

    app.delete(
        "/loteBonuses/:id", [authJwt.verifyToken],
        controller.deleteLoteBonuses
    );
};