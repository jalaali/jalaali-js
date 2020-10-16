const fs = require('fs');
const { execSync }  = require('child_process');
process.env.path += require('path').delimiter + './node_modules/.bin';

if (!fs.existsSync('dist')) fs.mkdirSync('dist');

fs.writeFileSync('x.js', "module.exports = require('./index.js');");
execSync('browserify x.js -s jalaali -o dist/jalaali.js');
execSync('terser dist/jalaali.js -c -m -o dist/jalaali.min.js');
fs.unlinkSync('x.js');