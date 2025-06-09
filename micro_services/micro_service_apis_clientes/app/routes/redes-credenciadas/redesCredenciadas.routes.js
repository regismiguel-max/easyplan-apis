const { verifyAuth } = require("../../middleware");
const controller = require("../../controllers/redes-credenciadas/redesCredenciadas.controller");
const up = require("../../controllers/redes-credenciadas/uploadRedesCredenciadas.controller");

module.exports = (app) => {
    app.use(function (err, req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    app.post(
        "/redescredenciadas",
        up.upload.single('file'),
        controller.addLoteRedesCredenciadas
    );

    app.post(
        "/redescredenciadas/semexclusao",
        up.upload.single('file'),
        controller.addLoteRedesCredenciadasSemExclusao
    );

    app.post(
        "/redescredenciadas/search",
        controller.searchRedesCredenciadas
    );

    app.get(
        "/redescredenciadas",
        controller.getLoteRedesCredenciadas
    );

    app.get(
        "/redescredenciadas/especialidades",
        controller.getEspecialidadesAll
    );

    app.get(
        "/redescredenciadas/produtos",
        controller.getProdutosAll
    );
};