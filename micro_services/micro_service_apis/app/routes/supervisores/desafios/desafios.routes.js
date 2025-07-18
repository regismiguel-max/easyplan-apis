const DesafiosSupervisoresController = require('../../../controllers/supervisores/desafios/desafios-supervisores.controller');

module.exports = (app) => {
    app.get("/supervisor/corretoras", DesafiosSupervisoresController.getAllByName);
};