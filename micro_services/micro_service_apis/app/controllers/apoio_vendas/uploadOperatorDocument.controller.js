const fs = require('fs');
const path = require('path');
const controller = require("../product.controller");
const db = require("../../../../../models");
const Document = db.document;

const multer = require("multer");

const date = new Date();
const baseUploadPath = path.resolve(__dirname, '../../../../../uploads');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (!fs.existsSync(`${baseUploadPath}/documents/${date.getFullYear()}/${date.getMonth() + 1 < 10 ? `0${date.getMonth() + 1}` : date.getMonth() + 1}`)) {
            try {
                fs.mkdirSync(`${baseUploadPath}/documents/${date.getFullYear()}/${date.getMonth() + 1 < 10 ? `0${date.getMonth() + 1}` : date.getMonth() + 1}`, { recursive: true });
                cb(null, `${baseUploadPath}/documents/${date.getFullYear()}/${date.getMonth() + 1 < 10 ? `0${date.getMonth() + 1}` : date.getMonth() + 1}/`);
            } catch (err) {
                console.error(err);
            }

        }
        else {
            cb(null, `${baseUploadPath}/documents/${date.getFullYear()}/${date.getMonth() + 1 < 10 ? `0${date.getMonth() + 1}` : date.getMonth() + 1}/`);
        }
    },
    filename: (req, file, cb) => {
        // cb(null, `${new Date().toISOString()}${file.originalname}`);
        cb(null, file.originalname);
    }
})

const fileFilter = (req, file, cb) => {
    Document.findOne({
        where: {
            name: req.body.name
        }
    }).then(doc => {
        if (doc) {

            return cb(null, true);
        } else {
            if (file.mimetype === 'image/jpeg' || file.mimetype == "image/jpg" || file.mimetype === 'image/png' || file.mimetype === 'application/pdf') {
                cb(null, true);
            } else {
                return cb(new Error('Formato não suportado'));
            }
        }
    });
}

exports.upload = multer({
    storage: storage,
    limits: {
        fileSize: 1024 * 1024 * 200
    },
    fileFilter: fileFilter
})