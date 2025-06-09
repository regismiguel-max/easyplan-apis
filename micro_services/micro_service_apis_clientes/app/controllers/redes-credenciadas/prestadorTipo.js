const db = require("../../../../../models");
const PrestadorTipo = db.redes_credenciadas_prestador_tipo;

exports.getPrestadorTipoAll = (req, res) => {
    PrestadorTipo.findAll(
        {
            order: [
                ['createdAt', 'DESC']
            ]
        }
    )
        .then(pre => {
            res.send({
                prestadorTipo: pre,
                message: "Essa lista contém os prestador tipo cadastrados no sistema!",
                sucesso: true
            });
        })
        .catch(err => {
            res.status(500).send({
                message: err.message,
                sucesso: false
            })
        })
};