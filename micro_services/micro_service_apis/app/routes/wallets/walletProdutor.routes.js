const { authJwt } = require("../../middleware");
const controller = require("../../controllers/wallets/walletProdutor.controller");

module.exports = (app) => {
    app.use(function (req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    app.get(
        "/wallets/produtor", [authJwt.verifyToken],
        controller.findAll
    );

    app.get(
        "/wallets/transactions/:produtorCPF", [authJwt.verifyToken],
        controller.findAllTransactions
    )

    app.post(
        "/wallets/transactions/search", [authJwt.verifyToken],
        controller.findSearchTransactions
    )

    app.get(
        "/wallets/payments/:produtorCPF", [authJwt.verifyToken],
        controller.findAllPayments
    )

    app.post(
        "/wallets/payments/search", [authJwt.verifyToken],
        controller.findSearchPayments
    )
};