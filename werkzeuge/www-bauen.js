// Stellt den Ordner "www" zusammen: genau die Dateien, die in die Android-App gepackt werden.
// Aufruf: node werkzeuge/www-bauen.js
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.join(root, 'www');
const files = ['index.html', 'style.css', 'app.js', 'config.js', 'manifest.webmanifest', 'icons'];

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out);
for (const name of files) {
  fs.cpSync(path.join(root, name), path.join(out, name), { recursive: true });
}
console.log(`www/ neu erstellt (${files.length} Einträge)`);
