const { authJwt } = require("../../middleware");
const controller = require("../../controllers/apoio_vendas/document.controller");
const up = require("../../controllers/apoio_vendas/uploadOperatorDocument.controller");


module.exports = (app) => {
    app.use(function (err, req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    app.post(
        "/document", [authJwt.verifyToken, authJwt.isAdmin],
        up.upload.single('file'),
        controller.addDocument
    );

    app.get(
        "/document",
        controller.findAll
    );

    app.get(
        "/document/:id",
        controller.findDocument
    );

    app.put(
        "/document/:id", [authJwt.verifyToken, authJwt.isAdmin],
        controller.updateDocument
    );

    app.delete(
        "/document/:id", [authJwt.verifyToken, authJwt.isAdmin],
        controller.deleteDocument
    );
};