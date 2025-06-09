const { authJwt } = require("../../middleware");
const controller = require("../../controllers/bonuses/bonuses.controller");

module.exports = (app) => {
    app.use(function (req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    app.post(
        "/bonuse", [authJwt.verifyToken],
        controller.addBonuse
    );

    app.post(
        "/bonuse/document/search",
        controller.findBonuseDocumentSearch
    );

    app.post(
        "/bonuse/produtor/search",
        controller.findBonuseProdutorSearch
    );

    app.post(
        "/bonuse/digitalsaude/search",
        controller.findBonuseDigitalSaudeSearch
    );

    app.get(
        "/bonuse",
        controller.findAll
    );

    app.get(
        "/bonuse/:id",
        controller.findBonuse
    );

    app.get(
        "/bonuse/digitalsaude/:codigo",
        controller.findBonuseDigitalSaude
    );

    app.get(
        "/bonuse/document/:documento",
        controller.findBonuseDocument
    );

    app.put(
        "/bonuse/:id", [authJwt.verifyToken],
        controller.updateBonuse
    );

    app.delete(
        "/bonuse/:id", [authJwt.verifyToken],
        controller.deleteBonuse
    );
};