const controller = require("../../controllers/utils/ckeditor.controller");
const up = require("../../controllers/utils/uploadCKeditor.controller");


module.exports = (app) => {
    app.use(function (err, req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    app.post(
        "/ckeditor/image",
        up.upload.single('file'),
        controller.addImage
    );
};