const { authJwt } = require("../../middleware");
const controller = require("../../controllers/corretoras/vendas.controller");


module.exports = (app) => {
    app.use(function (err, req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    app.post(
        "/corretora/vendas/buscarPorCPFNome",
        controller.buscarPorCPFNome
    );
};