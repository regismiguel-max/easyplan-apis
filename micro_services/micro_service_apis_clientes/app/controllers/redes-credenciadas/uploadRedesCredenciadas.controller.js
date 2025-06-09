const fs = require('fs');
const path = require('path');
const multer = require("multer");

const date = new Date();
const baseUploadPath = path.resolve(__dirname, '../../../../../uploads');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (!fs.existsSync(`${baseUploadPath}/redes-credenciadas/${date.getFullYear()}/${date.getMonth() + 1 < 10 ? `0${date.getMonth() + 1}` : date.getMonth() + 1}`)) {
            try {
                fs.mkdirSync(`${baseUploadPath}/redes-credenciadas/${date.getFullYear()}/${date.getMonth() + 1 < 10 ? `0${date.getMonth() + 1}` : date.getMonth() + 1}`, { recursive: true });
                cb(null, `${baseUploadPath}/redes-credenciadas/${date.getFullYear()}/${date.getMonth() + 1 < 10 ? `0${date.getMonth() + 1}` : date.getMonth() + 1}/`);
            } catch (err) {
                console.error(err);
            }

        }
        else {
            cb(null, `${baseUploadPath}/redes-credenciadas/${date.getFullYear()}/${date.getMonth() + 1 < 10 ? `0${date.getMonth() + 1}` : date.getMonth() + 1}/`);
        }
    },

    filename: (req, file, cb) => {
        const dat = new Date();
        cb(null, `REDES_CREDENCIADAS-${dat.getFullYear()}-${dat.getMonth() + 1 < 10 ? `0${dat.getMonth() + 1}` : dat.getMonth() + 1}-${dat.getDate() < 10 ? `0${dat.getDate()}` : dat.getDate()}_${date.getHours()}_${dat.getMinutes()}_${dat.getSeconds()}.xlsx`);
    }
})

const fileFilter = (req, file, cb) => {
    console.log(file.mimetype)
    if (file.mimetype === 'application/vnd.ms-excel' || file.mimetype == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || file.mimetype == "application/msexcel" || file.mimetype == "application/x-msexcel" || file.mimetype == "application/x-ms-excel" || file.mimetype == "application/x-excel" || file.mimetype == "application/x-dos_ms_excel" || file.mimetype == "application/xls" || file.mimetype == "application/x-xls" || file.mimetype == "application/vnd.ms-excel.sheet.macroenabled.12") {
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