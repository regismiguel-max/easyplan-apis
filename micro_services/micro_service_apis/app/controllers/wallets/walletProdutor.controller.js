const db = require("../../../../../models");
const Wallets = db.produtorWalletsBonuses;
const WalletsTransactions = db.produtorTransactionsBonuses;
const WalletsPayments = db.produtorPaymentsBonuses;

const { where, Op } = require("sequelize");
const moment = require('moment');

exports.findAll = (req, res) => {
    Wallets.findAll(
        {
            order: [
                ['produtorNome', 'ASC']
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
                ['createdAt', 'DESC']
            ],
            where: {
                produtorCPF: req.params.produtorCPF
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
    if (req.body.document) { where.produtorCPF = req.body.document; };
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

exports.findAllPayments = async (req, res) => {
    const wallet = await Wallets.findOne({ where: { produtorCPF: req.params.produtorCPF } });

    WalletsPayments.findAll(
        {
            order: [
                ['createdAt', 'DESC']
            ],
            where: {
                produtorCPF: req.params.produtorCPF
            }
        }
    )
        .then(pay => {
            res.send({
                payments: pay,
                wallet: wallet,
                message: "Essa lista contém todos os pagamentos cadastradas no sistema para essa wallet!",
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

exports.findSearchPayments = async (req, res) => {
    const wallet = await Wallets.findOne({ where: { produtorCPF: req.body.produtorCPF } });

    const where = {};
    if (req.body.produtorCPF) { where.produtorCPF = req.body.produtorCPF; };
    if (req.body.status) { where.status = req.body.status; };
    if (req.body.dataCriacao) {
        const dataPesquisa = req.body.dataCriacao;
        const inicioDoDia = moment.tz(dataPesquisa, 'America/Sao_Paulo').startOf('day').utc().toDate();
        const fimDoDia = moment.tz(dataPesquisa, 'America/Sao_Paulo').endOf('day').utc().toDate();
        where.createdAt = {
            [Op.between]: [inicioDoDia, fimDoDia]
        };
    };
    if (req.body.dataAtualizacao) {
        const dataPesquisa = req.body.dataAtualizacao;
        const inicioDoDia = moment.tz(dataPesquisa, 'America/Sao_Paulo').startOf('day').utc().toDate();
        const fimDoDia = moment.tz(dataPesquisa, 'America/Sao_Paulo').endOf('day').utc().toDate();
        where.updatedAt = {
            [Op.between]: [inicioDoDia, fimDoDia]
        };
    };

    WalletsPayments.findAll(
        {
            order: [
                ['createdAt', 'DESC']
            ],
            where
        }
    )
        .then(pay => {
            res.send({
                payments: pay,
                wallet: wallet,
                message: "Essa lista contém todos os pagamentos cadastradas no sistema para essa wallet!",
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