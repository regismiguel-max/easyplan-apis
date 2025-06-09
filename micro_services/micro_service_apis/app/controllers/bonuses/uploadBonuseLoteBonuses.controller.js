const fs = require('fs');
const path = require('path');
const db = require("../../../../../models");
const Document = db.document;

const multer = require("multer");

const date = new Date();
const baseUploadPath = path.resolve(__dirname, '../../../../../uploads');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (!fs.existsSync(`${baseUploadPath}/bonuses/${date.getFullYear()}/${date.getMonth() + 1 < 10 ? `0${date.getMonth() + 1}` : date.getMonth() + 1}`)) {
            try {
                fs.mkdirSync(`${baseUploadPath}/bonuses/${date.getFullYear()}/${date.getMonth() + 1 < 10 ? `0${date.getMonth() + 1}` : date.getMonth() + 1}`, { recursive: true });
                cb(null, `${baseUploadPath}/bonuses/${date.getFullYear()}/${date.getMonth() + 1 < 10 ? `0${date.getMonth() + 1}` : date.getMonth() + 1}/`);
            } catch (err) {
                console.error(err);
            }

        }
        else {
            cb(null, `${baseUploadPath}/bonuses/${date.getFullYear()}/${date.getMonth() + 1 < 10 ? `0${date.getMonth() + 1}` : date.getMonth() + 1}/`);
        }
    },
    filename: (req, file, cb) => {
        const dat = new Date();
        cb(null, `Tabela_Bonificacoes-${dat.getFullYear()}-${dat.getMonth() + 1 < 10 ? `0${dat.getMonth() + 1}` : dat.getMonth() + 1}-${dat.getDate() < 10 ? `0${dat.getDate()}` : dat.getDate()}_${date.getHours()}_${dat.getMinutes()}_${dat.getSeconds()}.xlsx`);
    }
})

const fileFilter = (req, file, cb) => {
    if (file.mimetype === 'application/vnd.ms-excel' || file.mimetype == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
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