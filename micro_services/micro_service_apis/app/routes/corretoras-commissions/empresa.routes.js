const controller = require("../../controllers/corretoras-commissions/empresa.controller");

module.exports = (app) => {
    app.use(function (req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    app.get(
        "/corretora/commissions/empresa/all",
        controller.findAll
    );

    app.get(
        "/corretora/commissions/empresa/:id",
        controller.findEmpresa
    );
};