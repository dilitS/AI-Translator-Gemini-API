import { safeStorageGet, safeStorageSet } from '../utils/storage.js';
import { showStatus } from '../utils/ui.js';

export class ApiKeyManager {
  constructor(elements) {
    this.elements = elements;
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.loadApiKeys();
  }

  setupEventListeners() {
    if (this.elements.saveApiKeyButton) {
      this.elements.saveApiKeyButton.addEventListener('click', () => {
        this.handleSaveApiKey();
      });
    }

    if (this.elements.apiKeyClearIcon) {
      this.elements.apiKeyClearIcon.addEventListener('click', () => {
        this.clearApiKey();
      });
    }

    if (this.elements.apiKeyInput) {
      this.elements.apiKeyInput.addEventListener('input', () => {
        this.handleApiKeyInput();
      });
    }
  }

  async loadApiKeys() {
    const storageData = await safeStorageGet(["geminiApiKeys", "geminiApiKey"]);
    const geminiApiKeys = storageData.geminiApiKeys || [];
    const geminiApiKey = storageData.geminiApiKey;

    // Check if we have any API keys (new multi-key system or legacy single key)
    const hasApiKeys = (geminiApiKeys && geminiApiKeys.length > 0) || geminiApiKey;

    if (hasApiKeys) {
      // For backward compatibility, show first available key
      const displayKey = geminiApiKey || (geminiApiKeys && geminiApiKeys[0]);
      if (displayKey) {
        this.elements.apiKeyInput.value = displayKey;
        this.elements.apiKeyClearIcon.classList.add("active");
        this.elements.apiKeyStatusIcon.classList.add("valid");
        this.elements.apiStatusTooltip.textContent = chrome.i18n.getMessage("API_STATUS_VALID_TOOLTIP");
        this.elements.apiStatusTooltip.style.color = "#4CAF50";
      }
    } else {
      this.elements.apiStatusTooltip.textContent = chrome.i18n.getMessage("API_STATUS_INVALID_TOOLTIP");
      this.elements.apiStatusTooltip.style.color = "#F44336";
    }

    this.renderApiKeysList(geminiApiKeys);
    return geminiApiKeys;
  }

  renderApiKeysList(apiKeys) {
    if (!this.elements.apiKeysContainer) return;

    this.elements.apiKeysContainer.innerHTML = "";

    if (apiKeys.length === 0) {
      const emptyState = document.createElement("div");
      emptyState.className = "aiGeminiTranslator_empty-state";
      emptyState.innerHTML = `
        <div style="color: #666; text-align: center; padding: 20px;">
          <p>No API keys configured</p>
          <small>Add your first Gemini API key above</small>
        </div>
      `;
      this.elements.apiKeysContainer.appendChild(emptyState);
      return;
    }

    apiKeys.forEach((key, index) => {
      const keyItem = this.createApiKeyItem(key, index);
      this.elements.apiKeysContainer.appendChild(keyItem);
    });
  }

  createApiKeyItem(key, index) {
    const keyItem = document.createElement("div");
    keyItem.className = "aiGeminiTranslator_api-key-item";

    const maskedKey = key.substring(0, 8) + "..." + key.substring(key.length - 4);

    keyItem.innerHTML = `
      <div class="aiGeminiTranslator_api-key-display">
        <span class="aiGeminiTranslator_api-key-text">${maskedKey}</span>
        <span class="aiGeminiTranslator_api-key-index">#${index + 1}</span>
      </div>
      <button class="aiGeminiTranslator_remove-key-btn" data-index="${index}">
        Remove
      </button>
    `;

    // Add remove button event listener
    const removeBtn = keyItem.querySelector('.aiGeminiTranslator_remove-key-btn');
    removeBtn.addEventListener('click', () => {
      this.removeApiKey(index);
    });

    return keyItem;
  }

  async removeApiKey(index) {
    if (!confirm("Are you sure you want to remove this API key?")) {
      return;
    }

    const storageData = await safeStorageGet(["geminiApiKeys"]);
    const geminiApiKeys = storageData.geminiApiKeys || [];
    const updatedKeys = geminiApiKeys.filter((_, i) => i !== index);

    const success = await safeStorageSet({ geminiApiKeys: updatedKeys });
    if (success) {
      await this.loadApiKeys();
      showStatus(
        this.elements.apiKeyStatus,
        `API key removed. Remaining: ${updatedKeys.length}`,
        "success"
      );
    } else {
      showStatus(this.elements.apiKeyStatus, "Failed to remove API key", "error");
    }
  }

  async handleSaveApiKey() {
    const apiKey = this.elements.apiKeyInput.value.trim();
    
    if (!apiKey) {
      this.updateStatus("API_KEY_EMPTY_MESSAGE", "red");
      return;
    }

    if (!this.isValidApiKeyFormat(apiKey)) {
      this.updateStatus("API_KEY_INVALID_FORMAT_MESSAGE", "red");
      return;
    }

    // Get existing keys
    const storageData = await safeStorageGet(["geminiApiKeys"]);
    const existingKeys = storageData.geminiApiKeys || [];

    // Check if key already exists
    if (existingKeys.includes(apiKey)) {
      this.updateStatus("API key already exists", "orange");
      return;
    }

    // Add new key to the list
    const updatedKeys = [...existingKeys, apiKey];
    
    const success = await safeStorageSet({ 
      geminiApiKeys: updatedKeys,
      geminiApiKey: apiKey // Keep for backward compatibility
    });

    if (success) {
      this.updateStatus("API_KEY_VALID_MESSAGE", "green");
      await this.loadApiKeys();
    } else {
      this.updateStatus("Failed to save API key", "red");
    }
  }

  handleApiKeyInput() {
    const hasValue = this.elements.apiKeyInput.value.trim().length > 0;
    this.elements.apiKeyClearIcon.classList.toggle("active", hasValue);
  }

  clearApiKey() {
    this.elements.apiKeyInput.value = "";
    this.elements.apiKeyClearIcon.classList.remove("active");
    this.elements.apiKeyStatusIcon.classList.remove("valid");
    this.elements.apiKeyStatusIcon.classList.add("invalid");
    this.elements.apiStatusTooltip.textContent = chrome.i18n.getMessage("API_STATUS_INVALID_TOOLTIP");
    this.elements.apiStatusTooltip.style.color = "#F44336";
  }

  isValidApiKeyFormat(apiKey) {
    // Basic validation for Gemini API key format
    return apiKey.length > 20 && /^[A-Za-z0-9_-]+$/.test(apiKey);
  }

  updateStatus(messageKey, color) {
    this.elements.apiKeyStatus.textContent = chrome.i18n.getMessage(messageKey);
    this.elements.apiKeyStatus.style.color = color;

    if (color === "green") {
      this.elements.apiKeyStatusIcon.classList.add("valid");
      this.elements.apiKeyStatusIcon.classList.remove("invalid");
      this.elements.apiKeyClearIcon.style.display = "block";
    } else {
      this.elements.apiKeyStatusIcon.classList.add("invalid");
      this.elements.apiKeyStatusIcon.classList.remove("valid");
      this.elements.apiKeyClearIcon.style.display = "none";
    }

    // Auto hide status message
    this.elements.apiKeyStatus.style.display = "block";
    setTimeout(() => {
      this.elements.apiKeyStatus.style.display = "none";
    }, 5000);

    // Update tooltip
    const hasValidApiKey = color === "green";
    this.elements.apiStatusTooltip.textContent = hasValidApiKey
      ? chrome.i18n.getMessage("API_STATUS_VALID_TOOLTIP")
      : chrome.i18n.getMessage("API_STATUS_INVALID_TOOLTIP");
    this.elements.apiStatusTooltip.style.color = hasValidApiKey ? "#4CAF50" : "#F44336";

    // Update icon classes
    this.elements.apiKeyStatusIcon.classList.toggle("valid", hasValidApiKey);
    this.elements.apiKeyStatusIcon.classList.toggle("invalid", !hasValidApiKey);
  }
}