const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
module.exports = {
    privateKey: process.env.PRIVATEKEY,
    secret_Key: process.env.SECRET_KEY,
    iv_Key: process.env.IV_KEY,
};