const fs = require('fs');
const path = require('path');

const leafletDist = path.dirname(require.resolve('leaflet/dist/leaflet.js'));
const destination = path.join(__dirname, '../public/vendor/leaflet');
fs.mkdirSync(destination, {recursive: true});
for (const file of ['leaflet.css', 'leaflet.js']) {
  fs.copyFileSync(path.join(leafletDist, file), path.join(destination, file));
}
fs.cpSync(path.join(leafletDist, 'images'), path.join(destination, 'images'), {recursive: true});
