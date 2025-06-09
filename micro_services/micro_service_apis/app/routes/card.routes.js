const { checkCard } = require("../middleware");
const controller = require("../controllers/card.controller");

module.exports = (app) => {
    app.use(function(req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    app.post(
        "/card/register", [
            // verifySignUp.checkDuplicateEmail,
            // verifySignUp.checkRolesExisted
            checkCard
        ],
        controller.cardRegister
    );

    // app.post("/card/user", controller.cardUser);
};