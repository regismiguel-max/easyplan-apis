const fs = require('fs');
const path = require('path');

module.exports = () => {
    const basePath = __dirname;

    return {
        key: fs.readFileSync(path.join(basePath, 'private.key'), 'utf8'),
        cert: fs.readFileSync(path.join(basePath, 'certificate.crt'), 'utf8'),
        ca: fs.readFileSync(path.join(basePath, 'ca_bundle.crt'), 'utf8'),
    };
};