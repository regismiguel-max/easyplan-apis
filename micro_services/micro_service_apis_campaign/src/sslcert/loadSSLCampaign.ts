import fs from 'fs';
import path from 'path';
import { ServerOptions } from 'https';

const basePath = path.resolve(__dirname, '../../src/sslcert');

const loadSSL = (): ServerOptions => {
  return {
    key: fs.readFileSync(path.join(basePath, 'private.key'), 'utf8'),
    cert: fs.readFileSync(path.join(basePath, 'certificate.crt'), 'utf8'),
    ca: fs.readFileSync(path.join(basePath, 'ca_bundle.crt'), 'utf8'),
  };
};

export default loadSSL;