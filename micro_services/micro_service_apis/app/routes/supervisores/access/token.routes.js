const { authJwt } = require("../../../middleware");
const controller = require("../../../controllers/supervisores/access/token.controller");

module.exports = (app) => {
    app.get(
        "/supervisor/baseapis/create/token", [authJwt.verifyCredentials],
        controller.createToken
    );
};
