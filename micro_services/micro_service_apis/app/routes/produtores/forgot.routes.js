const { authJwt } = require("../../middleware");
const controller = require("../../controllers/produtores/forgot.controller");

module.exports = function (app) {
    app.use(function (req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    app.post("/produtor/forgot", controller.forgot);

    app.put(
        "/produtor/forgot/acesso/:id", controller.updateProdutor
    );
};