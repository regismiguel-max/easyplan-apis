const { authJwt } = require("../../middleware");
const controller = require("../../controllers/corretoras-commissions/NFDocumento.controller");
const up = require("../../controllers/corretoras-commissions/uploadNFDocumento.controller");


module.exports = (app) => {
    app.use(function (req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    app.post(
        "/corretora/commissions/nf/:id", [authJwt.verifyToken],
        up.upload.single('file'),
        controller.addNFDocumento
    );

    app.get(
        "/corretora/commissions/nf/all",
        controller.findAll
    );
};