const db = require("../../../../../models");
const Produto = db.redes_credenciadas_produto;

exports.getProdutoAll = (req, res) => {
    Produto.findAll(
        {
            order: [
                ['createdAt', 'DESC']
            ]
        }
    )
        .then(prod => {
            res.send({
                produtos: prod,
                message: "Essa lista contém os produtos cadastrados no sistema!",
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