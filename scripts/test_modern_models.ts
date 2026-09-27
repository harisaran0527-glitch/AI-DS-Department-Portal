import dotenv from 'dotenv';
dotenv.config();

async function testModernModels() {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  const models = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-2.5-flash'];

  for (const model of models) {
    try {
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Respond with "Gemini API Connection Successful"' }] }]
        })
      });
      console.log(`Model [${model}]: HTTP Status ${resp.status}`);
      if (resp.ok) {
        const data = await resp.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        console.log(`🎉 SUCCESS WITH ${model}! Response: "${text}"`);
      } else {
        const errJson = await resp.json().catch(() => ({}));
        console.log(`❌ Error with ${model}: ${errJson.error?.message}`);
      }
    } catch (err: any) {
      console.log(`Fetch error for ${model}: ${err.message}`);
    }
  }
}

testModernModels().catch(console.error);
