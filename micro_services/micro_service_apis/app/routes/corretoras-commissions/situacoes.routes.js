const controller = require("../../controllers/corretoras-commissions/situacoes.controller");

module.exports = (app) => {
    app.use(function (req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    app.get(
        "/corretora/commissions/situacoes/all",
        controller.findAll
    );
};