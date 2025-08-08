const { authJwt } = require("../../middleware");
const { uploadNotaController, uploadMiddleware, getValidNF } = require('../../controllers/corretoras-commissions/uploadValidaNF.controller');


module.exports = (app) => {
    app.use(function (req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    app.post(
        "/corretora/commissions/valida/nf", [authJwt.verifyToken], uploadMiddleware, uploadNotaController
    );

    app.get(
        "/corretora/commissions/valida/nf", getValidNF
    );
};