const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

module.exports = {
    privateKey: process.env.PRIVATEKEY,
};