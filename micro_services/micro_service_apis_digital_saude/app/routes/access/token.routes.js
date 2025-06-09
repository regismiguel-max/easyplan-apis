const { authVerify } = require("../../middleware");
const controller = require("../../controllers/access/token.controller");

module.exports = (app) => {
    app.get(
        "/baseapis/create/token", [authVerify.verifyCredentials],
        controller.createToken
    );
};
