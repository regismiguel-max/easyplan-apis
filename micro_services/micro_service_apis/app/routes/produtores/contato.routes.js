const { authJwt } = require("../../middleware");
const controller = require("../../controllers/produtores/contato.controller");


module.exports = (app) => {
    app.use(function (err, req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    app.post(
        "/produtor/contato",
        controller.addContato
    );

    app.get(
        "/produtor/contato", [authJwt.verifyToken],
        controller.findAll
    );

    app.get(
        "/produtor/contato/:id", [authJwt.verifyToken],
        controller.findContato
    );

    app.put(
        "/produtor/contato/:id", [authJwt.verifyToken],
        controller.updateContato
    );

    app.delete(
        "/produtor/contato/:id", [authJwt.verifyToken],
        controller.deleteContato
    );
};