const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const webRoot = path.join(root, 'ma_nguon/giao_dien');
const publicRoot = path.join(root, 'public');

fs.rmSync(publicRoot, { recursive: true, force: true });
fs.mkdirSync(publicRoot, { recursive: true });
fs.cpSync(path.join(webRoot, 'kieu_dang'), path.join(publicRoot, 'css'), { recursive: true });
fs.cpSync(path.join(webRoot, 'ma_javascript'), path.join(publicRoot, 'js'), { recursive: true });

console.log('Đã chuẩn bị tài nguyên tĩnh trong public/ cho Vercel.');
