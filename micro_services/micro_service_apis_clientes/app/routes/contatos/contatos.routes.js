const { verifyAuth } = require("../../middleware");
const controller = require("../../controllers/contatos/contatos.controller");

module.exports = function (app) {
    app.use(function (req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    app.post(
        "/contato",
        controller.addContato
    );

    app.get(
        "/contato",
        controller.findContatos
    );

    app.get(
        "/contato/:codigo",
        controller.findContatos
    );

};