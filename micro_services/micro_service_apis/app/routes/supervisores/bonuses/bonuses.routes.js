const { authJwt } = require("../../../middleware");
const controller = require("../../../controllers/supervisores/bonuses/bonuses.controller");

module.exports = function(app) {
    app.use(function(req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    app.post(
        "/supervisor/produtor/bonuses", [authJwt.verifyToken],
        controller.findBonuses
    );
};