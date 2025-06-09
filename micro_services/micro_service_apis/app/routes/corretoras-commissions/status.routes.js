const { authJwt } = require("../../middleware");
const controller = require("../../controllers/corretoras-commissions/status.controller");
const up = require("../../controllers/corretoras-commissions/uploadCommissionLoteCommissions.controller");

module.exports = (app) => {
    app.use(function (req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    app.get(
        "/corretora/commissions/status/all",
        controller.findAll
    );
};