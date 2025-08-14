const { authJwt } = require("../../middleware");
const controller = require("../../controllers/wallets/walletCorretora.controller");

module.exports = (app) => {
    app.use(function (req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    app.get(
        "/wallets/corretora", [authJwt.verifyToken],
        controller.findAll
    );

    app.get(
        "/wallets/transactions/corretora/:corretoraCNPJ", [authJwt.verifyToken],
        controller.findAllTransactions
    )

    app.post(
        "/wallets/transactions/corretora/search", [authJwt.verifyToken],
        controller.findSearchTransactions
    )
};