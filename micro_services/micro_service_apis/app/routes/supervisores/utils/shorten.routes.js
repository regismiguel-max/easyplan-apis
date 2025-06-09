const { authJwt } = require("../../middleware");
const controller = require("../../controllers/utils/shorten.controller");


module.exports = (app) => {
    app.use(function (err, req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    app.get(
        "/supervisor/shorten/:id",
        controller.findShorten
    );
};