const fs = require('fs');
const html = fs.readFileSync('C:\\Users\\Hector\\.gemini\\antigravity-ide\\brain\\b48ae5e9-a301-4bed-aff7-cf74cd37a546\\.system_generated\\steps\\2444\\content.md', 'utf8');

const tMatch = html.match(/<title>([^<]+)<\/title>/);
console.log('TITLE:', tMatch ? tMatch[1] : 'none');

// Find og:description or app description
const ogDesc = html.match(/meta property="og:description" content="([^"]+)"/);
console.log('OG DESC:', ogDesc ? ogDesc[1] : 'none');

const descMatch = html.match(/data-g-id="description"[\s\S]*?>([\s\S]*?)<\/div>/);
if (descMatch) {
  console.log('APP DESC:', descMatch[1].replace(/<br>/g, '\n').replace(/<[^>]+>/g, '').trim());
}

// Find screenshots or features
const images = [];
const imgRegex = /src="(https:\/\/play-lh\.googleusercontent\.com\/[^"]+)"/g;
let m;
while ((m = imgRegex.exec(html)) !== null) {
  images.push(m[1]);
}
console.log('Found screenshots:', images.length);
if (images.length > 0) {
  console.log('First 3 screenshots:', images.slice(0, 3));
}
