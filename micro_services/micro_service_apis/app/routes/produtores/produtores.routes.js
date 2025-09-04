const { authJwt, verifyProdutor } = require("../../middleware");
const controller = require("../../controllers/produtores/produtores.controller");
const up = require("../../controllers/produtores/uploadImagemGladiador.controller");


module.exports = (app) => {
    app.use(function (err, req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    app.post(
        "/produtor/add",
        controller.addProdutor
    );

    app.post(
        "/produtor/search", [authJwt.verifyToken],
        controller.findProdutoresSearch
    );

    app.post(
        "/produtor/estado", [authJwt.verifyToken],
        controller.findProdutoresEstados
    );

    app.post(
        "/produtor/enderecos", [authJwt.verifyToken],
        controller.findAllProdutorEndereco
    );

    app.get(
        "/produtor", [authJwt.verifyToken],
        controller.findAll
    );

    app.get(
        "/produtor/:id", [authJwt.verifyToken],
        controller.findProdutor
    );


    app.get(
        "/produtor/verifyprodutor/:cpf", [verifyProdutor.checkDuplicateCPF],
    );

    app.put(
        "/produtor/:id", [authJwt.verifyToken],
        controller.updateProdutor
    );

    app.put(
        "/produtor/imagem/gladiador/:id", [authJwt.verifyToken],
        up.upload.single('file'),
        controller.updateImagemGladiador
    );

    app.delete(
        "/produtor/:id", [authJwt.verifyToken],
        controller.deleteProdutor
    );
};