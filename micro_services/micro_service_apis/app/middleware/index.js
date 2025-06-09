const authJwt = require("./authJwt");
const verifySignUp = require("./verifySignUp");
const checkCard = require("./checkCard");
const checkProduct = require("./checkProduct");
const verifyCorretora = require("./verifyCorretora");
const verifyWhatsApp = require("./verifyWhatsApp");
const verifyProdutor = require("./verifyProdutor");

module.exports = {
    authJwt,
    verifySignUp,
    checkCard,
    checkProduct,
    verifyCorretora,
    verifyWhatsApp,
    verifyProdutor
};