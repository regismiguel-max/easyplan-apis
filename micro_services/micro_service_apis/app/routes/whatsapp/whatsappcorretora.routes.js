const { authJwt } = require("../../middleware");
const controller = require("../../controllers/whatsapp/whatsapp.controller");


module.exports = (app) => {
    app.use(function (err, req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    app.post(
        "/whatsapp/corretora/sendmessagelinkpreview", [authJwt.verifyToken],
        controller.sendMessageLinkPreview
    );

    app.post(
        "/whatsapp/corretora/sendmessagelinkdocument", [authJwt.verifyToken],
        controller.sendMessageLinkDocument
    );

    app.post(
        "/whatsapp/operacao/sendmessagesarah",
        controller.sendMessageSarah
    );

    app.post(
        "/whatsapp/operacao/sendmessage/api/oficial",
        controller.sendMessageAPIOficial
    );
};