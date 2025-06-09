const { authJwt } = require("../../middleware");
const controller = require("../../controllers/swile/paymentLoteBonuses.controller");

module.exports = (app) => {
    app.use(function (req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    app.get(
        "/payment/verify/:lote_ID", [authJwt.verifyToken],
        controller.verifyPayment
    );

    app.get(
        "/payment/lote/:lote_ID", [authJwt.verifyToken],
        controller.getPayment
    );

    app.get(
        "/payment/teste", [authJwt.verifyToken],
        controller.verifyPayment
    );

    // app.get(
    //     "/loteBonuses/:id",
    //     controller.findLoteBonuses
    // );

    // app.put(
    //     "/loteBonuses/:id", [authJwt.verifyToken],
    //     controller.updateLoteBonuse
    // );

    // app.delete(
    //     "/loteBonuses/:id", [authJwt.verifyToken],
    //     controller.deleteLoteBonuses
    // );
};