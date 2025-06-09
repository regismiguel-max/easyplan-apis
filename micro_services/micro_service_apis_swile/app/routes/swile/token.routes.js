const { authJwt } = require("../../middleware");
const controller = require("../../controllers/swile/token.controller");
const controller1 = require("../../controllers/swile/paymentLoteBonuses.controller");

module.exports = (app) => {
    app.get(
        "/payment/create/token/:id", [authJwt.verifyCredentials],
        controller.createToken
    );

};
