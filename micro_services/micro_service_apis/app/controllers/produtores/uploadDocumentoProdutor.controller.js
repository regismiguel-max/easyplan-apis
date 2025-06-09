const fs = require('fs');
const path = require('path');
const db = require("../../../../../models");

const multer = require("multer");

const date = new Date();
const baseUploadPath = path.resolve(__dirname, '../../../../../uploads');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (!fs.existsSync(`${baseUploadPath}/produtores/documento_produtor/${date.getFullYear()}/${date.getMonth() + 1 < 10 ? `0${date.getMonth() + 1}` : date.getMonth() + 1}`)) {
            try {
                fs.mkdirSync(`${baseUploadPath}/produtores/documento_produtor/${date.getFullYear()}/${date.getMonth() + 1 < 10 ? `0${date.getMonth() + 1}` : date.getMonth() + 1}`, { recursive: true });
                cb(null, `${baseUploadPath}/produtores/documento_produtor/${date.getFullYear()}/${date.getMonth() + 1 < 10 ? `0${date.getMonth() + 1}` : date.getMonth() + 1}/`);
            } catch (err) {
                console.error(err);
            }

        }
        else {
            cb(null, `${baseUploadPath}/produtores/documento_produtor/${date.getFullYear()}/${date.getMonth() + 1 < 10 ? `0${date.getMonth() + 1}` : date.getMonth() + 1}/`);
        }
    },
    filename: (req, file, cb) => {
        let type
        const dat = new Date();
        if (file.mimetype === 'application/pdf') {
            type = 'pdf'
        }
        else if (file.mimetype === 'image/jpeg') {
            type = 'jpeg'
        }
        else if (file.mimetype === 'image/jpg') {
            type = 'jpg'
        }
        else if (file.mimetype === 'image/png') {
            type = 'png'
        }
        else {
            type = 'pdf'
        }
        cb(null, `Documento_Produtor-${dat.getFullYear()}-${dat.getMonth() + 1 < 10 ? `0${dat.getMonth() + 1}` : dat.getMonth() + 1}-${dat.getDate() < 10 ? `0${dat.getDate()}` : dat.getDate()}-${dat.getHours()}-${dat.getMinutes()}-${dat.getSeconds()}.${type}`);
    }
})

const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'image/jpeg' || file.mimetype == "image/jpg" || file.mimetype === 'image/png' || file.mimetype === 'application/pdf') {
        cb(null, true);
    } else {
        return cb(new Error('Formato não suportado'));
    }
}

exports.upload = multer({
    storage: storage,
    limits: {
        fileSize: 1024 * 1024 * 200
    },
    fileFilter: fileFilter
})