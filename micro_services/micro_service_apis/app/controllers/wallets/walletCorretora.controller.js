const db = require("../../../../../models");
const Wallets = db.corretoraWalletsCommissions;
const WalletsTransactions = db.corretoraTransactionsCommissions;
const WalletsPayments = db.corretoraPaymentsCommissions;

const { where, Op } = require("sequelize");
const moment = require('moment');

exports.findAll = (req, res) => {
    Wallets.findAll(
        {
            order: [
                ['corretoraRazaoSocial', 'ASC']
            ],
        }
    )
        .then(wa => {
            res.send({
                wallets: wa,
                message: "Essa lista contém todas as carteiras cadastradas no sistema!",
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

exports.findAllTransactions = (req, res) => {
    WalletsTransactions.findAll(
        {
            order: [
                ['createdAt', 'ASC']
            ],
            where: {
                corretoraCNPJ: req.params.corretoraCNPJ
            }
        }
    )
        .then(tra => {
            res.send({
                transactions: tra,
                message: "Essa lista contém todas as transações cadastradas no sistema para essa wallet!",
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

exports.findSearchTransactions = (req, res) => {
    const where = {};
    if (req.body.document) { where.corretoraCNPJ = req.body.document; };
    if (req.body.tipo) { where.tipo = req.body.tipo; };
    if (req.body.dataLancamento) {
        where.dataLancamento = req.body.dataLancamento;
    };
    if (req.body.vigencia) {
        where.vigencia = req.body.vigencia;
    };
    if (req.body.nomeCliente) {
        where.clienteNome = { [Op.like]: `%${req.body.nomeCliente}%` };
    };

    WalletsTransactions.findAll(
        {
            order: [
                ['createdAt', 'DESC']
            ],
            where
        }
    )
        .then(tra => {
            res.send({
                transactions: tra,
                message: "Essa lista contém todas as transações cadastradas no sistema para essa wallet!",
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
