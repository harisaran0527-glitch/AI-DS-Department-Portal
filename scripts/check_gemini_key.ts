import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
console.log('GEMINI_API_KEY present in .env:', Boolean(apiKey && apiKey.trim().length > 0));
if (apiKey) {
  console.log('Key length:', apiKey.length);
  console.log('Key starts with:', apiKey.substring(0, 4) + '...');
}
