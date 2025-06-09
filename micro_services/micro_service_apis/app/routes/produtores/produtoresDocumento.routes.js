const { authJwt } = require("../../middleware");
const controller = require("../../controllers/produtores/produtorDocumento.controller");
const up = require("../../controllers/produtores/uploadDocumentoProdutor.controller");


module.exports = (app) => {
    app.use(function (err, req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    app.post(
        "/produtor/documento",
        up.upload.single('file'),
        controller.addProdutorDocumento
    );

    app.get(
        "/produtor/documento", [authJwt.verifyToken],
        controller.findAll
    );

    app.get(
        "/produtor/documento/:id", [authJwt.verifyToken],
        controller.findProdutorDocumento
    );

    app.put(
        "/produtor/documento/:id", [authJwt.verifyToken],
        up.upload.single('file'),
        controller.updateProdutorDocumento
    );

    app.delete(
        "/produtor/documento/:id", [authJwt.verifyToken],
        controller.deleteProdutorDocumento
    );
};