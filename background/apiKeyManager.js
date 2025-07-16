import config from "./config.js";

// API Key Pool Management
export class ApiKeyManager {
  constructor() {
    this.apiKeys = [];
    this.currentKeyIndex = 0;
    this.keyStatus = new Map(); // Track health status of each key
    this.rateLimitRetryAfter = new Map(); // Track rate limit cooldowns
  }

  async loadApiKeys() {
    const { geminiApiKeys, geminiApiKey } = await chrome.storage.local.get([
      "geminiApiKeys",
      "geminiApiKey",
    ]);

    // Migrate single API key to array format if needed
    if (geminiApiKey && !geminiApiKeys) {
      this.apiKeys = [geminiApiKey];
      await chrome.storage.local.set({ geminiApiKeys: this.apiKeys });
    } else {
      this.apiKeys = geminiApiKeys || [];
    }

    // Initialize status for all keys
    this.apiKeys.forEach((key) => {
      if (!this.keyStatus.has(key)) {
        this.keyStatus.set(key, {
          healthy: true,
          lastError: null,
          errorCount: 0,
        });
      }
    });
  }

  async getNextAvailableKey() {
    await this.loadApiKeys();

    if (this.apiKeys.length === 0) {
      throw new Error(config.API_KEY_NOT_SET_MESSAGE);
    }

    const now = Date.now();
    let attempts = 0;

    // Try each key in rotation
    while (attempts < this.apiKeys.length) {
      const currentKey = this.apiKeys[this.currentKeyIndex];
      const keyStatus = this.keyStatus.get(currentKey);
      const rateLimitInfo = this.rateLimitRetryAfter.get(currentKey);

      // Check if key is available (not rate limited and healthy)
      const isRateLimited = rateLimitInfo && now < rateLimitInfo.retryAfter;
      const isTooManyErrors = keyStatus && keyStatus.errorCount >= 3;

      if (!isRateLimited && !isTooManyErrors) {
        return {
          key: currentKey,
          index: this.currentKeyIndex,
        };
      }

      // Move to next key
      this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
      attempts++;
    }

    throw new Error(
      "All API keys are currently unavailable due to rate limits or errors"
    );
  }

  markKeyAsRateLimited(keyIndex, retryAfterSeconds = 60) {
    const key = this.apiKeys[keyIndex];
    if (key) {
      const retryAfter = Date.now() + retryAfterSeconds * 1000;
      this.rateLimitRetryAfter.set(key, { retryAfter, timestamp: Date.now() });
      console.log(
        `API key ${keyIndex + 1} rate limited, retry after ${retryAfterSeconds}s`
      );
    }
  }

  markKeyError(keyIndex, error) {
    const key = this.apiKeys[keyIndex];
    if (key) {
      const status = this.keyStatus.get(key) || {
        healthy: true,
        lastError: null,
        errorCount: 0,
      };
      status.errorCount++;
      status.lastError = error;
      status.healthy = status.errorCount < 3;
      this.keyStatus.set(key, status);
      console.log(`API key ${keyIndex + 1} error count: ${status.errorCount}`);
    }
  }

  markKeySuccess(keyIndex) {
    const key = this.apiKeys[keyIndex];
    if (key) {
      // Reset error count on successful request
      const status = this.keyStatus.get(key) || {
        healthy: true,
        lastError: null,
        errorCount: 0,
      };
      status.errorCount = Math.max(0, status.errorCount - 1);
      status.healthy = true;
      status.lastError = null;
      this.keyStatus.set(key, status);
    }
  }

  async getKeyStatus() {
    await this.loadApiKeys();
    const now = Date.now();

    return this.apiKeys.map((key, index) => {
      const status = this.keyStatus.get(key) || {
        healthy: true,
        lastError: null,
        errorCount: 0,
      };
      const rateLimitInfo = this.rateLimitRetryAfter.get(key);
      const isRateLimited = rateLimitInfo && now < rateLimitInfo.retryAfter;

      return {
        index: index + 1,
        key: key.substring(0, 8) + "..." + key.substring(key.length - 4), // Masked key
        healthy: status.healthy,
        errorCount: status.errorCount,
        isRateLimited,
        rateLimitEndsIn: isRateLimited
          ? Math.ceil((rateLimitInfo.retryAfter - now) / 1000)
          : 0,
      };
    });
  }
}