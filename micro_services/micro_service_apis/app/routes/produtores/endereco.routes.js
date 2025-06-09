const { authJwt } = require("../../middleware");
const controller = require("../../controllers/produtores/endereco.controller");


module.exports = (app) => {
    app.use(function (err, req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    app.post(
        "/produtor/endereco",
        controller.addEndereco
    );

    app.get(
        "/produtor/endereco", [authJwt.verifyToken],
        controller.findAll
    );

    app.get(
        "/produtor/endereco/:id", [authJwt.verifyToken],
        controller.findEndereco
    );

    app.put(
        "/produtor/endereco/:id", [authJwt.verifyToken],
        controller.updateEndereco
    );

    app.delete(
        "/produtor/endereco/:id", [authJwt.verifyToken],
        controller.deleteEndereco
    );
};