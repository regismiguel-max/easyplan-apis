const { authJwt } = require("../../../middleware");
const controller = require("../../../controllers/supervisores/commissions/commissions.controller");

module.exports = function(app) {
    app.use(function(req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    app.post(
        "/supervisor/corretora/commissions", [authJwt.verifyToken],
        controller.findCommissions
    );
};