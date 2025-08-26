const db = require("../../../../../../models");
const Operadoras = db.utils_digital_saude_operadoras;
const Produtos = db.utils_digital_saude_produtos;

const xlsx = require('node-xlsx');
const moment = require('moment');
const { where, Op } = require("sequelize");

exports.addOperadorasProdutos = async (req, res) => {
  try {
    await db.sequelize.query("SET FOREIGN_KEY_CHECKS = 0");
    await db.sequelize.query("TRUNCATE TABLE utils_digital_saude_operadora_produto");
    await db.sequelize.query("TRUNCATE TABLE utils_digital_saude_produtos");
    await db.sequelize.query("TRUNCATE TABLE utils_digital_saude_operadoras");
    await db.sequelize.query("SET FOREIGN_KEY_CHECKS = 1");

    await addCreate(req, res);
  } catch (err) {
    return res.status(500).send({ sucesso: false, message: err.message });
  }
};

const addCreate = async (req, res) => {
  const filePath = `${req.file.destination}${req.file.filename}`;
  const plan = await xlsx.parse(filePath);
  const operadoras = [];
  const operadorasCodigo = new Set();

  for (let i = 1; i < plan[0].data.length; i++) {
    const row = plan[0].data[i];
    const codigo = row[1];
    if (!operadorasCodigo.has(codigo)) {
      operadorasCodigo.add(codigo);
      operadoras.push({
        codigo,
        nome: row[0] || '',
        nomeTipo: row[2] || '',
        produtos: [parseProduto(row)]
      });
    } else {
      const index = operadoras.findIndex(op => op.codigo === codigo);
      operadoras[index].produtos.push(parseProduto(row));
    }
  }

  try {
    for (const operadora of operadoras) {
      const novaOperadora = await Operadoras.create({
        codigo: operadora.codigo,
        nome: operadora.nome,
        nomeTipo: operadora.nomeTipo
      });

      for (const produto of operadora.produtos) {
        const novoProduto = await Produtos.create(produto);

        await db.sequelize.query(
          `INSERT INTO utils_digital_saude_operadora_produto (operadora_ID, produto_ID) VALUES (?, ?)`,
          {
            replacements: [novaOperadora.id, novoProduto.id],
            type: db.sequelize.QueryTypes.INSERT
          }
        );
      }
    }

    return res.send({
      sucesso: true,
      message: "Operadoras e produtos cadastrados com sucesso!"
    });
  } catch (err) {
    return res.status(500).send({ sucesso: false, message: err.message });
  }
};

const parseProduto = row => ({
  codigo: row[3] || '',
  nome: row[4] || '',
  status: row[5] || '',
  regiao: row[6] || '',
  registroANS: row[7] || '',
  acomodacao: row[8] || '',
  abrangencia: row[9] || '',
  coparticipacao: row[10] || '',
  integracaoDoPlano: row[11] || ''
});


ReturnError = async (res, err) => {
    res.status(500).send({
        message: err.message,
        sucesso: false
    });
}

exports.getOperadorasProdutos = (req, res) => {
    Operadoras.findAll(
        {
            order: [
                ['nomeTipo', 'ASC']
            ],
            include: [

                {
                    model: db.utils_digital_saude_produtos,
                }
            ],
        }
    )
        .then(ope => {
            res.send({
                operadoras: ope,
                message: "Essa lista contém as operadoras e produtos cadastrados no sistema!",
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