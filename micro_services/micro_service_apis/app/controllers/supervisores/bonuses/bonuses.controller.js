const db = require("../../../../../../models");
const Bonuse = db.bonuse;
const { where, Op } = require("sequelize");

exports.findBonuses = (req, res) => {
    let where;
    if (req.body.documento && req.body.produtor) {
        where = {
            [Op.or]: {
                documento: `%${req.body.documento}%`,
                produtor: `%${req.body.produtor}%`
            },
        }
    }
    else if (req.body.documento && !req.body.produtor) {
        where = { documento: { [Op.like]: `%${req.body.documento}%` } }
    }
    else if (req.body.produtor && !req.body.documento) {
        where = { produtor: { [Op.like]: `%${req.body.produtor}%` } }
    };
    Bonuse.findAll(
        {
            where
        }
    )
        .then(bo => {
            res.send({
                bonuses: bo,
                message: "Essa lista contém o bônus cadastrado no sistema!",
                sucesso: true
            });;
        })
        .catch(err => {
            res.status(500).send({
                message: err.message,
                sucesso: false
            })
        })
};
