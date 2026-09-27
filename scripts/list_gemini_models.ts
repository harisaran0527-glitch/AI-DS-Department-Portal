import dotenv from 'dotenv';
dotenv.config();

async function listModels() {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  console.log('Querying Google AI Studio ListModels API...\n');

  try {
    const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    console.log(`HTTP Status: ${resp.status}`);
    const data = await resp.json();
    if (resp.ok) {
      console.log('Available Models:');
      const supported = (data.models || []).filter((m: any) => (m.supportedGenerationMethods || []).includes('generateContent'));
      console.table(supported.map((m: any) => ({ name: m.name, displayName: m.displayName, version: m.version })));
    } else {
      console.log('Error:', data.error?.message);
    }
  } catch (err: any) {
    console.error('Fetch error:', err.message);
  }
}

listModels().catch(console.error);
