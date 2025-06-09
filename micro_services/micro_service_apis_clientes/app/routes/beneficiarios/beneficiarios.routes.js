const { verifyAuth } = require("../../middleware");
const controller = require("../../controllers/beneficiarios/beneficiarios.controller");
const up = require("../../controllers/beneficiarios/uploadBeneficiarios.controller");

module.exports = (app) => {
    app.use(function (err, req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    app.post(
        "/beneficiarios/cassi/verify",
        up.upload.single('file'),
        controller.verifyCPF
    );
};