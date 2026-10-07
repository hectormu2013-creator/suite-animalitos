const fs = require('fs');

const path = 'C:\\Users\\Hector\\Downloads\\PremierPluss20 (2).exe';
const fd = fs.openSync(path, 'r');
const buf = Buffer.alloc(4096);
fs.readSync(fd, buf, 0, 4096, 0);
fs.closeSync(fd);

console.log('Magic MZ:', buf.toString('ascii', 0, 2));
const content = buf.toString('latin1');
if (content.includes('Inno Setup')) console.log('Type: Inno Setup Installer');
else if (content.includes('Nullsoft')) console.log('Type: NSIS Installer');
else if (content.includes('7-Zip')) console.log('Type: 7-Zip SFX');
else if (content.includes('BSJB')) console.log('Type: .NET Binary (BSJB CLR Header)');
else console.log('Other PE Executable');

// Search strings for URLs, endpoints, domains
const bigBuf = Buffer.alloc(1024 * 1024);
const fd2 = fs.openSync(path, 'r');
fs.readSync(fd2, bigBuf, 0, bigBuf.length, 0);
fs.closeSync(fd2);
const bigStr = bigBuf.toString('latin1');
const urls = [...bigStr.matchAll(/https?:\/\/[a-zA-Z0-9_\-\.\:]+/gi)].map(m => m[0]);
const uniqueUrls = [...new Set(urls)];
console.log('URLs encontradas en el instalador:', uniqueUrls);
