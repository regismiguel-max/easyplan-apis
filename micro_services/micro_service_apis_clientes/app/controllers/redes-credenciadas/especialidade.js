const db = require("../../../../../models");
const Especialidade = db.redes_credenciadas_especialidade;

exports.getEspecialidadeAll = (req, res) => {
    Especialidade.findAll(
        {
            order: [
                ['especialidade', 'ASC']
            ],
        }
    )
        .then(esp => {
            res.send({
                especialidades: esp,
                message: "Essa lista contém as especialidades cadastradas no sistema!",
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