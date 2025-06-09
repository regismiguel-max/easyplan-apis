const db = require("../../../../models");
const Product = db.product;

exports.productRegister = (req, res) => {
    // Save Product to Database
    const urlImagem = (req.headers.host === 'localhost:3000') ? 'http://localhost:3000/' : 'https://localhost:3001/'
    Product.create({
            name: req.body.name,
            descricao: req.body.descricao,
            imagem: `${urlImagem}${req.file.destination}${req.file.filename}`,
            preco: req.body.preco,
            precopromocional: req.body.precopromocional
        })
        .then(product => {
            if (product) {
                res.send({
                    product: {
                        id: product.id,
                        name: product.name,
                        descricao: product.descricao,
                        imagem: product.imagem,
                        preco: product.preco,
                        precopromocional: product.precopromocional
                    },
                    message: "Produto cadastrado com sucesso!"
                });
            } else {
                res.status(401).send({ message: err.message });
            }
        })
        .catch(err => {
            res.status(500).send({ message: err.message });
        });
};

exports.productAll = (req, res) => {
    Product.findAll()
        .then(product => {
            res.send({
                products: product,
                message: "Essa lista contém todos produtos cadastrados no sistema!"
            });
        })
        .catch(err => {
            res.status(500).send({ message: err.message })
        })
};