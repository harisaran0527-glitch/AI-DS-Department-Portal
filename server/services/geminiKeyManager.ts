import dotenv from 'dotenv';

dotenv.config();

export interface ManagedApiKey {
  id: string; // Environment variable name, e.g. 'GEMINI_API_KEY_1'
  key: string;
  maskedKey: string;
  isInvalid: boolean;
  exhaustedUntil: number; // Unix timestamp in ms
  lastErrorMessage?: string;
  quotaGroup: string; // Group identifier for shared quota tracking
}

export interface GeminiApiStatus {
  isConfigured: boolean;
  model: string;
  statusMessage: string;
  totalKeysConfigured?: number;
  availableKeysCount?: number;
}

export interface GeminiGenerationOptions {
  preferredModels?: string[];
  maxOutputTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}

export interface GeminiGenerationResult {
  success: boolean;
  text?: string;
  model?: string;
  keyId?: string;
  error?: string;
  isQuotaExhausted?: boolean;
}

export const DEFAULT_GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-1.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-pro',
  'gemini-flash-latest'
];

export const DEFAULT_COOLDOWN_MS = 60000; // 60 seconds default cooldown

/**
 * Masks an API key for safe logging and diagnostic inspection.
 * Never displays the full key in logs, responses, or error messages.
 */
export function maskApiKey(key?: string | null): string {
  if (!key) return '[NOT CONFIGURED]';
  const trimmed = key.trim();
  if (trimmed.length <= 8) return '****';
  return `${trimmed.substring(0, 4)}...${trimmed.substring(trimmed.length - 4)}`;
}

/**
 * Checks if a key string is a valid non-placeholder key.
 */
function isValidKeyString(val?: string | null): boolean {
  if (!val) return false;
  const trimmed = val.trim();
  if (trimmed.length < 10) return false;
  const lower = trimmed.toLowerCase();
  if (
    lower.includes('your_google_gemini_api_key_here') ||
    lower.includes('your_gemini_api_key') ||
    lower.includes('placeholder') ||
    lower === 'null' ||
    lower === 'undefined'
  ) {
    return false;
  }
  return true;
}

/**
 * Parses the HTTP 'Retry-After' header if present.
 * Supports both integer seconds ('60') and HTTP-date strings.
 */
export function parseRetryAfterHeader(headerValue?: string | null, defaultMs = DEFAULT_COOLDOWN_MS): number {
  if (!headerValue) return defaultMs;
  const trimmed = headerValue.trim();

  // 1. Try parsing integer seconds
  const seconds = parseInt(trimmed, 10);
  if (!isNaN(seconds) && seconds > 0) {
    return seconds * 1000;
  }

  // 2. Try parsing HTTP-Date format (e.g. 'Wed, 21 Oct 2026 07:28:00 GMT')
  const parsedDate = Date.parse(trimmed);
  if (!isNaN(parsedDate)) {
    const diff = parsedDate - Date.now();
    return diff > 0 ? diff : defaultMs;
  }

  return defaultMs;
}

/**
 * Determines whether a response or error corresponds to a genuine rate limit or quota exhaustion.
 */
export function isGenuineQuotaError(status: number, errorBody?: any, errorText?: string): boolean {
  if (status === 429) return true;

  const msg = (
    (errorBody?.error?.message || '') +
    ' ' +
    (errorBody?.error?.status || '') +
    ' ' +
    (errorText || '')
  ).toLowerCase();

  if (
    msg.includes('resource_exhausted') ||
    msg.includes('quota exceeded') ||
    msg.includes('rate limit') ||
    msg.includes('too many requests') ||
    msg.includes('exceeded your current quota') ||
    msg.includes('resource has been exhausted')
  ) {
    return true;
  }

  return false;
}

/**
 * Determines whether an error corresponds to an invalid key / authentication failure.
 */
export function isAuthenticationError(status: number, errorBody?: any, errorText?: string): boolean {
  if (status === 401) return true;

  const msg = (
    (errorBody?.error?.message || '') +
    ' ' +
    (errorBody?.error?.status || '') +
    ' ' +
    (errorText || '')
  ).toLowerCase();

  if (
    msg.includes('api_key_invalid') ||
    msg.includes('api key not valid') ||
    msg.includes('invalid api key') ||
    (status === 403 && msg.includes('permission_denied'))
  ) {
    return true;
  }

  return false;
}

/**
 * Centralized Gemini API Key Manager
 */
class GeminiKeyManager {
  private keys: ManagedApiKey[] = [];
  private lastInitializedEnvHash = '';

  constructor() {
    this.refreshKeysFromEnv();
  }

  /**
   * Discovers and registers all Gemini API keys from environment variables.
   * Priority:
   *  1. GEMINI_API_KEY_1, GEMINI_API_KEY_2, GEMINI_API_KEY_3... (Sequential order)
   *  2. GEMINI_API_KEY (Legacy single-key variable)
   *  3. GOOGLE_API_KEY (Alternative Google Cloud variable)
   * Deduplicates keys and groups identical keys to prevent artificial quota duplication.
   */
  public refreshKeysFromEnv(): void {
    const currentEnvHash = Object.keys(process.env)
      .filter((k) => k.startsWith('GEMINI_API_KEY') || k === 'GOOGLE_API_KEY')
      .map((k) => `${k}=${process.env[k]}`)
      .join(';');

    if (currentEnvHash === this.lastInitializedEnvHash && this.keys.length > 0) {
      return;
    }

    this.lastInitializedEnvHash = currentEnvHash;

    // Preserve existing dynamic states (isInvalid, exhaustedUntil) if key values match
    const previousStateMap = new Map<string, { isInvalid: boolean; exhaustedUntil: number; lastError?: string }>();
    for (const k of this.keys) {
      previousStateMap.set(k.key, {
        isInvalid: k.isInvalid,
        exhaustedUntil: k.exhaustedUntil,
        lastError: k.lastErrorMessage
      });
    }

    const discoveredKeys: { id: string; key: string; order: number; quotaGroup?: string }[] = [];

    // 1. Discover indexed keys: GEMINI_API_KEY_1, GEMINI_API_KEY_2, ...
    const indexedKeyRegex = /^GEMINI_API_KEY_(\d+)$/;
    for (const envKey of Object.keys(process.env)) {
      const match = envKey.match(indexedKeyRegex);
      if (match) {
        const index = parseInt(match[1], 10);
        const val = process.env[envKey]?.trim();
        if (isValidKeyString(val)) {
          const customGroup = process.env[`${envKey}_GROUP`] || process.env.GEMINI_QUOTA_GROUP;
          discoveredKeys.push({
            id: envKey,
            key: val!,
            order: index,
            quotaGroup: customGroup
          });
        }
      }
    }

    // Sort indexed keys sequentially (1, 2, 3...)
    discoveredKeys.sort((a, b) => a.order - b.order);

    // 2. Discover standard GEMINI_API_KEY for backward compatibility
    const legacyKey = process.env.GEMINI_API_KEY?.trim();
    if (isValidKeyString(legacyKey)) {
      const exists = discoveredKeys.some((k) => k.key === legacyKey);
      if (!exists) {
        // If GEMINI_API_KEY_1 was not set, this legacy key takes order 0 (top priority)
        const order = discoveredKeys.length === 0 ? 0 : 999;
        discoveredKeys.push({
          id: 'GEMINI_API_KEY',
          key: legacyKey!,
          order,
          quotaGroup: process.env.GEMINI_QUOTA_GROUP
        });
      }
    }

    // 3. Discover GOOGLE_API_KEY as optional fallback
    const googleKey = process.env.GOOGLE_API_KEY?.trim();
    if (isValidKeyString(googleKey)) {
      const exists = discoveredKeys.some((k) => k.key === googleKey);
      if (!exists) {
        discoveredKeys.push({
          id: 'GOOGLE_API_KEY',
          key: googleKey!,
          order: 1000,
          quotaGroup: process.env.GEMINI_QUOTA_GROUP
        });
      }
    }

    // Re-sort after incorporating legacy/fallback keys
    discoveredKeys.sort((a, b) => a.order - b.order);

    // Build managed keys list with deduplication and state preservation
    const seenKeyValues = new Set<string>();
    const newKeys: ManagedApiKey[] = [];

    for (const item of discoveredKeys) {
      if (seenKeyValues.has(item.key)) {
        // Key is identical to an earlier configured key; link them to the same quota group
        continue;
      }
      seenKeyValues.add(item.key);

      const prevState = previousStateMap.get(item.key);
      const quotaGroup = item.quotaGroup || `group_${item.id}_${item.key.slice(-8)}`;

      newKeys.push({
        id: item.id,
        key: item.key,
        maskedKey: maskApiKey(item.key),
        isInvalid: prevState?.isInvalid || false,
        exhaustedUntil: prevState?.exhaustedUntil || 0,
        lastErrorMessage: prevState?.lastError,
        quotaGroup
      });
    }

    this.keys = newKeys;

    if (this.keys.length > 0) {
      const maskedList = this.keys.map((k) => `${k.id} (${k.maskedKey})`).join(', ');
      console.log(`🔑 [GeminiKeyManager] Loaded ${this.keys.length} API key(s) in priority sequence: [${maskedList}]`);
    }
  }

  /**
   * Returns metadata for all managed keys (never exposes raw keys).
   */
  public getManagedKeys(): Array<Omit<ManagedApiKey, 'key'>> {
    this.refreshKeysFromEnv();
    return this.keys.map(({ key: _secret, ...safe }) => safe);
  }

  /**
   * Returns total number of configured valid keys.
   */
  public getTotalKeyCount(): number {
    this.refreshKeysFromEnv();
    return this.keys.length;
  }

  /**
   * Resets all in-memory exhausted timers and invalid key states.
   * Useful for unit testing or manual administrative reset.
   */
  public resetKeyStates(): void {
    for (const k of this.keys) {
      k.isInvalid = false;
      k.exhaustedUntil = 0;
      k.lastErrorMessage = undefined;
    }
  }

  /**
   * Checks whether all configured keys are currently exhausted or invalid.
   */
  public isAllKeysExhausted(): boolean {
    this.refreshKeysFromEnv();
    if (this.keys.length === 0) return true;
    const now = Date.now();
    return this.keys.every((k) => k.isInvalid || k.exhaustedUntil > now);
  }

  /**
   * Returns remaining cooldown in seconds until the earliest key becomes eligible.
   * Returns 0 if an eligible key is immediately available.
   */
  public getCooldownRemaining(): number {
    this.refreshKeysFromEnv();
    const now = Date.now();
    const available = this.keys.find((k) => !k.isInvalid && k.exhaustedUntil <= now);
    if (available) return 0;

    const validKeys = this.keys.filter((k) => !k.isInvalid && k.exhaustedUntil > now);
    if (validKeys.length === 0) return 0;

    const earliestReset = Math.min(...validKeys.map((k) => k.exhaustedUntil));
    return Math.max(1, Math.ceil((earliestReset - now) / 1000));
  }

  /**
   * Finds the first eligible API key in priority order (1, 2, 3...)
   * that is neither invalid nor currently in cooldown.
   */
  public getEligibleKey(): ManagedApiKey | null {
    this.refreshKeysFromEnv();
    const now = Date.now();
    for (const k of this.keys) {
      if (!k.isInvalid && k.exhaustedUntil <= now) {
        return k;
      }
    }
    return null;
  }

  /**
   * Marks a key and all keys sharing its quota group as exhausted until reset period expires.
   */
  public markKeyExhausted(keyIdOrKey: string, cooldownMs = DEFAULT_COOLDOWN_MS, reason = 'Rate limit / Quota exceeded'): void {
    const target = this.keys.find((k) => k.id === keyIdOrKey || k.key === keyIdOrKey);
    const exhaustedUntil = Date.now() + cooldownMs;
    const group = target?.quotaGroup;

    for (const k of this.keys) {
      if (k === target || (group && k.quotaGroup === group)) {
        k.exhaustedUntil = Math.max(k.exhaustedUntil, exhaustedUntil);
        k.lastErrorMessage = reason;
      }
    }

    const resetSec = Math.ceil(cooldownMs / 1000);
    console.warn(
      `⚠️ [GeminiKeyManager] Key ${target ? target.id : 'unknown'} (${target ? target.maskedKey : 'masked'}) exhausted. Quota cooldown active for ${resetSec}s. Reason: ${reason}`
    );
  }

  /**
   * Marks a key permanently invalid (e.g. 400/401 API_KEY_INVALID).
   * Does NOT treat this as a rate limit to rotate through or wait on cooldown.
   */
  public markKeyInvalid(keyIdOrKey: string, reason = 'API key not valid / Authentication failed'): void {
    const target = this.keys.find((k) => k.id === keyIdOrKey || k.key === keyIdOrKey);
    if (target) {
      target.isInvalid = true;
      target.lastErrorMessage = reason;
      console.error(`🚫 [GeminiKeyManager] Key ${target.id} (${target.maskedKey}) marked INVALID. Authentication failed.`);
    }
  }

  /**
   * Executes a Gemini API generateContent call with automatic key failover.
   *
   * Flow:
   *  1. Selects Key 1 (or highest-priority eligible key).
   *  2. Calls Gemini API using preferred model fallbacks.
   *  3. If active key receives a genuine 429 / RESOURCE_EXHAUSTED:
   *     - Parses retry-after header and records cooldown.
   *     - Selects the next eligible key.
   *     - Retries the original prompt with preserved context.
   *  4. If all keys are exhausted: returns controlled error with cooldown.
   *  5. Non-quota errors (400, auth failure, bad payload) do NOT trigger key rotation.
   */
  public async generateContent(
    prompt: string,
    options: GeminiGenerationOptions = {}
  ): Promise<GeminiGenerationResult> {
    this.refreshKeysFromEnv();

    if (this.keys.length === 0) {
      return {
        success: false,
        error: 'No Gemini API keys are configured in backend environment variables.',
        isQuotaExhausted: false
      };
    }

    if (this.isAllKeysExhausted()) {
      const remainingSec = this.getCooldownRemaining();
      return {
        success: false,
        error: `All configured Gemini API keys are currently in quota cooldown. Next key available in ${remainingSec}s.`,
        isQuotaExhausted: true
      };
    }

    const models = options.preferredModels || DEFAULT_GEMINI_MODELS;
    const timeoutMs = options.timeoutMs || 10000;

    // Loop through eligible keys until one succeeds or all configured keys are exhausted
    while (true) {
      const activeKey = this.getEligibleKey();
      if (!activeKey) {
        const remainingSec = this.getCooldownRemaining();
        return {
          success: false,
          error: `All configured Gemini API keys are currently in quota cooldown. Next key available in ${remainingSec}s.`,
          isQuotaExhausted: true
        };
      }

      let keyHitQuota = false;
      let quotaCooldownMs = DEFAULT_COOLDOWN_MS;
      let quotaErrorMessage = '';
      let nonQuotaError: { message: string; isAuth: boolean } | null = null;

      // Try models in order for this key
      for (const model of models) {
        try {
          const controller = new AbortController();
          const timerId = setTimeout(() => controller.abort(), timeoutMs);

          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${activeKey.key}`;
          const bodyPayload: any = {
            contents: [{ parts: [{ text: prompt }] }]
          };

          if (options.temperature !== undefined || options.maxOutputTokens !== undefined) {
            bodyPayload.generationConfig = {};
            if (options.temperature !== undefined) bodyPayload.generationConfig.temperature = options.temperature;
            if (options.maxOutputTokens !== undefined) bodyPayload.generationConfig.maxOutputTokens = options.maxOutputTokens;
          }

          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bodyPayload),
            signal: controller.signal
          });

          clearTimeout(timerId);

          if (response.ok) {
            const data: any = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text && text.trim().length > 0) {
              // Success! Clear any existing error state on this key
              activeKey.lastErrorMessage = undefined;
              return {
                success: true,
                text: text.trim(),
                model,
                keyId: activeKey.id
              };
            }
          }

          // Inspect error response
          const errData: any = await response.json().catch(() => ({}));
          const errMessage = errData.error?.message || `HTTP ${response.status}`;

          // Check if genuine rate-limit / quota error
          if (isGenuineQuotaError(response.status, errData, errMessage)) {
            keyHitQuota = true;
            quotaErrorMessage = errMessage;
            const retryAfterHeader = response.headers.get('retry-after');
            quotaCooldownMs = parseRetryAfterHeader(retryAfterHeader, DEFAULT_COOLDOWN_MS);
            break; // Break model loop to switch key
          }

          // Check if authentication error / invalid key
          if (isAuthenticationError(response.status, errData, errMessage)) {
            this.markKeyInvalid(activeKey.id, errMessage);
            nonQuotaError = { message: `Authentication failure on ${activeKey.id}: ${errMessage}`, isAuth: true };
            break; // Stop and do not rotate as a quota error
          }

          // Non-quota 400 Bad Request (Invalid prompt / argument) -> Do not rotate
          if (response.status === 400) {
            nonQuotaError = { message: `Bad request error: ${errMessage}`, isAuth: false };
            break; // Do not retry with other keys if prompt itself is invalid
          }
        } catch (fetchErr: any) {
          // Network timeout or connection abort: try next model
          if (fetchErr.name === 'AbortError') {
            console.warn(`[GeminiKeyManager] Request timed out on model ${model} with key ${activeKey.id}.`);
          }
        }
      }

      // If genuine quota error occurred, mark this key exhausted and attempt failover to next key
      if (keyHitQuota) {
        this.markKeyExhausted(activeKey.id, quotaCooldownMs, quotaErrorMessage);

        // Check if there is another eligible key configured
        const nextEligible = this.getEligibleKey();
        if (nextEligible) {
          console.log(
            `🔄 [GeminiKeyManager] Failing over: ${activeKey.id} (${activeKey.maskedKey}) ➔ ${nextEligible.id} (${nextEligible.maskedKey})`
          );
          // Loop continues and retries the prompt with nextEligible
          continue;
        } else {
          const remainingSec = this.getCooldownRemaining();
          return {
            success: false,
            error: `All configured Gemini API keys have exhausted their quota. Cooldown active for ${remainingSec}s. (${quotaErrorMessage})`,
            isQuotaExhausted: true
          };
        }
      }

      // If a non-quota error occurred (e.g. invalid request or auth error), return immediately without rotating
      if (nonQuotaError) {
        return {
          success: false,
          error: nonQuotaError.message,
          isQuotaExhausted: false
        };
      }

      // If all models failed without explicit quota error (e.g. network/DNS glitch on this key), fail safely
      return {
        success: false,
        error: `Gemini API call failed across models for key ${activeKey.id}.`,
        isQuotaExhausted: false
      };
    }
  }

  /**
   * Tests live connection to Google Gemini API using active keys or a specified key.
   */
  public async testConnection(specificKey?: string): Promise<{
    success: boolean;
    text?: string;
    activeModel?: string;
    activeKeyId?: string;
    error?: string;
  }> {
    this.refreshKeysFromEnv();

    const prompt = 'Respond with "Gemini API connection verified successfully."';

    if (specificKey) {
      if (!isValidKeyString(specificKey)) {
        return { success: false, error: 'Provided key is missing or invalid.' };
      }

      for (const model of DEFAULT_GEMINI_MODELS) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 8000);
          const resp = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${specificKey.trim()}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
              signal: controller.signal
            }
          );
          clearTimeout(timer);

          if (resp.ok) {
            const data: any = await resp.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            return { success: true, text: text?.trim(), activeModel: model };
          }

          const errData: any = await resp.json().catch(() => ({}));
          const errMsg = errData.error?.message || `HTTP ${resp.status}`;
          if (isGenuineQuotaError(resp.status, errData, errMsg)) {
            return { success: false, error: `Quota exceeded: ${errMsg}` };
          }
          if (isAuthenticationError(resp.status, errData, errMsg)) {
            return { success: false, error: `Authentication failed: ${errMsg}` };
          }
        } catch (_e) {}
      }
      return { success: false, error: 'Could not connect to Gemini API with provided key.' };
    }

    // Use managed keys with failover
    const result = await this.generateContent(prompt, { timeoutMs: 8000 });
    if (result.success) {
      return {
        success: true,
        text: result.text,
        activeModel: result.model,
        activeKeyId: result.keyId
      };
    }

    return {
      success: false,
      error: result.error || 'Gemini API connection test failed.'
    };
  }

  /**
   * Returns current Gemini API system status for dashboard display.
   */
  public getApiStatus(): GeminiApiStatus {
    this.refreshKeysFromEnv();
    const total = this.keys.length;
    const now = Date.now();
    const available = this.keys.filter((k) => !k.isInvalid && k.exhaustedUntil <= now).length;

    if (total === 0) {
      return {
        isConfigured: false,
        model: 'gemini-2.5-flash',
        statusMessage: 'GEMINI_API_KEY environment variables are missing/unconfigured in backend .env. Using deterministic comparative rule engine fallback.',
        totalKeysConfigured: 0,
        availableKeysCount: 0
      };
    }

    if (available === 0) {
      const remainingSec = this.getCooldownRemaining();
      return {
        isConfigured: false,
        model: 'gemini-2.5-flash',
        statusMessage: `All ${total} configured Gemini API keys are in quota cooldown (${remainingSec}s remaining). Using deterministic rule engine fallback.`,
        totalKeysConfigured: total,
        availableKeysCount: 0
      };
    }

    const activeKey = this.getEligibleKey();
    return {
      isConfigured: true,
      model: 'gemini-2.5-flash',
      statusMessage: `Gemini 2.5 Flash Active (${available}/${total} keys available, Active: ${activeKey?.id || 'Ready'})`,
      totalKeysConfigured: total,
      availableKeysCount: available
    };
  }
}

// Export singleton instance
export const geminiKeyManager = new GeminiKeyManager();

// Also export default instance
export default geminiKeyManager;
