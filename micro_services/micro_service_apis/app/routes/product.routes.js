const fs = require('fs');
const { checkProduct } = require("../middleware");
const controller = require("../controllers/product.controller");
const db = require("../models");
const Product = db.product;

const multer = require("multer");
const date = new Date();
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (!fs.existsSync(`uploads/documents/${date.getFullYear()}/${date.getMonth() + 1 < 10 ? `0${date.getMonth() + 1}` : date.getMonth() + 1}`)) {
            try {
                fs.mkdirSync(`uploads/documents/${date.getFullYear()}/${date.getMonth() + 1 < 10 ? `0${date.getMonth() + 1}` : date.getMonth() + 1}`, { recursive: true });
                cb(null, `uploads/documents/${date.getFullYear()}/${date.getMonth() + 1 < 10 ? `0${date.getMonth() + 1}` : date.getMonth() + 1}/`);
            } catch (err) {
                console.error(err);
            }

        }
        else {
            cb(null, `uploads/documents/${date.getFullYear()}/${date.getMonth() + 1 < 10 ? `0${date.getMonth() + 1}` : date.getMonth() + 1}/`);
        }

    },
    filename: (req, file, cb) => {
        // cb(null, `${new Date().toISOString()}${file.originalname}`);
        cb(null, file.originalname);
    }
})

const fileFilter = (req, file, cb) => {
    Product.findOne({
        where: {
            name: req.body.name
        }
    }).then(prod => {
        if (prod) {

            return cb(new Error('Já exite produto cadastrado com esse nome!'));
            // return cb(new Error('Já exite produto cadastrado com esse nome!'));
        } else {
            if (file.mimetype === 'image/jpeg' || file.mimetype == "image/jpg" || file.mimetype === 'image/png' || file.mimetype === 'application/pdf') {
                cb(null, true);
            } else {
                return cb(new Error('Formato não suportado'));
            }
        }
    });
}

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 1024 * 1024 * 200
    },
    fileFilter: fileFilter
})



module.exports = (app) => {
    app.use(function (err, req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    app.post(
        "/product/register",
        upload.single('imagem'),
        controller.productRegister
    );

    app.get("/product/all", controller.productAll);
};