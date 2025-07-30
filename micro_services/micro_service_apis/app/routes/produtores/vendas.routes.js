const { authJwt } = require("../../middleware");
const controller = require("../../controllers/produtores/vendas.controller");


module.exports = (app) => {
    app.use(function (err, req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    app.post(
        "/produtor/vendas/buscarPorCPFNome",
        controller.buscarPorCPFNome
    );
};