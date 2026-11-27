// Which torque dataset BoltSpec uses.
// Default: src/torque-data.json (the one that ships with the site).
// Local only: local-data/torque-data.json, used ONLY when BOLTSPEC_LOCAL_DATA=1 is set AND the file exists.
// local-data/ is not part of deploy/pack.command, the Dockerfile or the upload, so it never reaches boltspec.autos.
const fs = require('fs');
const path = require('path');
const LOCAL = path.join(__dirname, '..', 'local-data', 'torque-data.json');
const useLocal = process.env.BOLTSPEC_LOCAL_DATA === '1' && fs.existsSync(LOCAL);
let D;
if (useLocal) {
  try { D = require(LOCAL); console.log('BoltSpec: using LOCAL dataset (local-data/torque-data.json) – not for deploy'); }
  catch (e) { console.error('BoltSpec: cannot read local-data/torque-data.json (' + e.code + ': ' + e.message + ') – using src/torque-data.json'); }
}
if (!D) D = require('./torque-data.json');
module.exports = D;
