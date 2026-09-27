import fs from 'fs';
import path from 'path';

const mediaDir = path.resolve(process.cwd(), 'public', 'media');
const files = fs.readdirSync(mediaDir);

console.log('📹 Checking public/media files:');
files.forEach((f) => {
  const stat = fs.statSync(path.join(mediaDir, f));
  console.log(`- ${f}: ${(stat.size / 1024 / 1024).toFixed(2)} MB (${stat.size} bytes)`);
});
