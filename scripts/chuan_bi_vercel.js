const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const webRoot = path.join(root, 'ma_nguon/giao_dien');
const publicRoot = path.join(root, 'public');

fs.rmSync(publicRoot, { recursive: true, force: true });
fs.mkdirSync(publicRoot, { recursive: true });
fs.cpSync(path.join(webRoot, 'kieu_dang'), path.join(publicRoot, 'css'), { recursive: true });
fs.cpSync(path.join(webRoot, 'ma_javascript'), path.join(publicRoot, 'js'), { recursive: true });

const vendorRoot = path.join(publicRoot, 'vendor');
fs.mkdirSync(vendorRoot, { recursive: true });
for (const filename of ['three.module.min.js', 'three.core.min.js']) {
  fs.copyFileSync(
    path.join(root, 'node_modules/three/build', filename),
    path.join(vendorRoot, filename),
  );
}

console.log('Đã chuẩn bị tài nguyên tĩnh trong public/ cho Vercel.');
