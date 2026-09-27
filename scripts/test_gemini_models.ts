import dotenv from 'dotenv';
dotenv.config();

async function testModels() {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  const models = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-2.5-flash', 'gemini-1.5-flash-8b'];

  console.log('Testing model endpoints with configured API key...\n');

  for (const model of models) {
    try {
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Hello, respond with "OK"' }] }]
        })
      });
      console.log(`Model [${model}]: HTTP Status ${resp.status}`);
      if (resp.ok) {
        const data = await resp.json();
        console.log(`  -> SUCCESS! Response: "${data.candidates?.[0]?.content?.parts?.[0]?.text?.trim()}"`);
      } else {
        const errJson = await resp.json().catch(() => ({}));
        console.log(`  -> Error: ${errJson.error?.message}`);
      }
    } catch (err: any) {
      console.log(`Model [${model}]: Fetch Error ${err.message}`);
    }
  }
}

testModels().catch(console.error);
