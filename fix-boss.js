const fs = require('fs');
let c = fs.readFileSync('public/boss/index.html', 'utf8');
c = c.replace('textContent = \'?\'', 'textContent = \'▲\'');
fs.writeFileSync('public/boss/index.html', c);
