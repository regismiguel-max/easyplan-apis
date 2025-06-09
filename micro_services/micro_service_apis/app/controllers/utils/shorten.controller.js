const db = require("../../../../../models");
const Shorten = db.utils_shortens;

const { where, Op } = require("sequelize");


exports.findShorten = (req, res) => {
    Shorten.findByPk(req.params.id)
        .then(sh => {
            res.send({
                shorten: sh,
                message: "Essa lista contém o shorten cadastrado no sistema!",
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
