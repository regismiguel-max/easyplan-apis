const db = require("../../../../models");
const Product = db.product;

CheckProduct = (req, res, next) => {
    // Product
    console.log(getContentType());
    Product.findOne({
        where: {
            name: req.body.name
        }
    }).then(prod => {
        if (prod) {
            res.status(400).send({
                message: "Falhou! Já exite produto cadastrado com esse nome!"
            });
            return;
        } else {
            next();
        }
    });
};


const checkProduct = CheckProduct;

module.exports = checkProduct;