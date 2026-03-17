const fs = require('fs');
let c = fs.readFileSync('public/boss/index.html', 'utf8');
c = c.replace(/â–¼/g, '▼');
c = c.replace(/â–²/g, '▲');
fs.writeFileSync('public/boss/index.html', c);
