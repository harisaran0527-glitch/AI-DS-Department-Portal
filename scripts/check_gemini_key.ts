import dotenv from 'dotenv';
import { geminiKeyManager } from '../server/services/geminiKeyManager.js';

dotenv.config();

console.log('=== GEMINI API KEY MANAGER STATUS CHECK ===\n');

const status = geminiKeyManager.getApiStatus();
console.log(`Configured: ${status.isConfigured ? 'YES' : 'NO'}`);
console.log(`Model: ${status.model}`);
console.log(`Status Message: ${status.statusMessage}`);
console.log(`Total Keys Configured: ${status.totalKeysConfigured}`);
console.log(`Available Keys: ${status.availableKeysCount}\n`);

const keys = geminiKeyManager.getManagedKeys();
if (keys.length > 0) {
  console.log('Managed Keys (Masked):');
  keys.forEach((k, idx) => {
    const isReady = !k.isInvalid && k.exhaustedUntil <= Date.now();
    console.log(`  [${idx + 1}] ${k.id}: ${k.maskedKey} | Status: ${isReady ? 'READY' : k.isInvalid ? 'INVALID' : 'COOLDOWN'} | Quota Group: ${k.quotaGroup}`);
  });
} else {
  console.log('No valid Gemini API keys detected in environment variables.');
}

