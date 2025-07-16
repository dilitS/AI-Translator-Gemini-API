import config from "../background/config.js";

// Define text elements for dynamic content
const textElements = {
  "aiGeminiTranslator_select-label": "TEXT_TO_TRANSLATE_LABEL",
  "aiGeminiTranslator_translate-text-button": "TRANSLATE_TEXT_BUTTON_TEXT",
  "aiGeminiTranslator_save-api-key-button": "SAVE_API_KEY_BUTTON_TEXT",
  "aiGeminiTranslator_text-to-translate": "TEXT_TO_TRANSLATE_PLACEHOLDER",
  "aiGeminiTranslator_translated-text": "TRANSLATED_TEXT_PLACEHOLDER",
  "aiGeminiTranslator_text-translation-status":
    "TEXT_TRANSLATION_STATUS_MESSAGE",
  "aiGeminiTranslator_api-key-input": "API_KEY_PLACEHOLDER",
  "aiGeminiTranslator_translation-card-header-title":
    "TRANSLATION_CARD_HEADER_TITLE",
  "aiGeminiTranslator_settings-card-header-title": "SETTINGS_CARD_HEADER_TITLE",
  "aiGeminiTranslator_selected-text-language-label":
    "SELECTED_TEXT_LANGUAGE_LABEL",
  "aiGeminiTranslator_api-key-label": "API_KEY_LABEL",
  "aiGeminiTranslator_copy-icon": "COPY_ICON_TOOLTIP",
  "aiGeminiTranslator_history-card-header-title": "HISTORY_CARD_HEADER_TITLE",
  "aiGeminiTranslator_select-all-button": "HISTORY_SELECT_ALL_BUTTON_TEXT",
  "aiGeminiTranslator_delete-selected-button":
    "HISTORY_DELETE_SELECTED_BUTTON_TEXT",
};

// Mode configurations
const modeConfigs = {
  translation: {
    titleKey: "TRANSLATION_MODE_TITLE",
    inputPlaceholderKey: "TEXT_TO_TRANSLATE_PLACEHOLDER",
    outputPlaceholderKey: "TRANSLATED_TEXT_PLACEHOLDER",
    buttonTextKey: "TRANSLATE_TEXT_BUTTON_TEXT",
    labelKey: "TEXT_TO_TRANSLATE_LABEL",
    showLanguageSelect: true
  },
  "image-prompt": {
    titleKey: "IMAGE_PROMPT_MODE_TITLE",
    inputPlaceholderKey: "IMAGE_PROMPT_INPUT_PLACEHOLDER",
    outputPlaceholderKey: "IMAGE_PROMPT_OUTPUT_PLACEHOLDER",
    buttonTextKey: "IMPROVE_PROMPT_BUTTON_TEXT",
    labelKey: "IMAGE_PROMPT_LABEL",
    showLanguageSelect: true
  },
  "text-correction": {
    titleKey: "TEXT_CORRECTION_MODE_TITLE",
    inputPlaceholderKey: "TEXT_CORRECTION_INPUT_PLACEHOLDER",
    outputPlaceholderKey: "TEXT_CORRECTION_OUTPUT_PLACEHOLDER",
    buttonTextKey: "CORRECT_TEXT_BUTTON_TEXT",
    labelKey: "TEXT_CORRECTION_LABEL",
    showLanguageSelect: true
  }
};

const systemLanguage = chrome.i18n.getUILanguage().split("-")[0];

// Safe storage helper function
async function safeStorageGet(keys) {
  try {
    if (chrome && chrome.storage && chrome.storage.local) {
      return await chrome.storage.local.get(keys);
    } else {
      console.warn('Chrome storage API not available');
      return {};
    }
  } catch (error) {
    console.error('Storage get error:', error);
    return {};
  }
}

async function safeStorageSet(data) {
  try {
    if (chrome && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set(data);
      return true;
    } else {
      console.warn('Chrome storage API not available');
      return false;
    }
  } catch (error) {
    console.error('Storage set error:', error);
    return false;
  }
}

async function safeStorageRemove(keys) {
  try {
    if (chrome && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.remove(keys);
      return true;
    } else {
      console.warn('Chrome storage API not available');
      return false;
    }
  } catch (error) {
    console.error('Storage remove error:', error);
    return false;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  let apiKey = "";

  // Get DOM elements
  const elements = {
    modeSelector: document.getElementById("aiGeminiTranslator_mode-selector"),
    apiKeyInput: document.getElementById("aiGeminiTranslator_api-key-input"),
    saveApiKeyButton: document.getElementById(
      "aiGeminiTranslator_save-api-key-button"
    ),
    showApiStatusButton: document.getElementById(
      "aiGeminiTranslator_show-api-status-button"
    ),
    textToTranslateTextarea: document.getElementById(
      "aiGeminiTranslator_text-to-translate"
    ),
    translatedTextTextarea: document.getElementById(
      "aiGeminiTranslator_translated-text"
    ),
    textTargetLanguageSelect: document.getElementById(
      "aiGeminiTranslator_text-target-language"
    ),
    translateTextButton: document.getElementById(
      "aiGeminiTranslator_translate-text-button"
    ),
    apiKeyStatus: document.getElementById("aiGeminiTranslator_api-key-status"),
    textTranslationStatus: document.getElementById(
      "aiGeminiTranslator_text-translation-status"
    ),
    settingsCard: document.querySelector(".aiGeminiTranslator_card.collapsed"),
    settingsHeader: document.querySelector("#settingsHeader"),
    apiKeyStatusIcon: document.querySelector(
      ".aiGeminiTranslator_api-key-status-icon"
    ),
    apiKeyClearIcon: document.querySelector(
      ".aiGeminiTranslator_api-key-clear-icon"
    ),
    copyIcon: document.querySelector(".aiGeminiTranslator_copy-icon"),
    apiStatusTooltip: document.querySelector(
      ".aiGeminiTranslator_api-status-tooltip"
    ),
    selectedTextLanguageSelect: document.getElementById(
      "aiGeminiTranslator_selected-text-language"
    ),
    statusElement: document.getElementById("aiGeminiTranslator_status"),
    historyList: document.getElementById("aiGeminiTranslator_history-list"),
    selectAllButton: document.getElementById(
      "aiGeminiTranslator_select-all-button"
    ),
    deleteSelectedButton: document.getElementById(
      "aiGeminiTranslator_delete-selected-button"
    ),
    apiKeysContainer: document.getElementById(
      "aiGeminiTranslator_api-keys-container"
    ),

    selectLabel: document.getElementById("aiGeminiTranslator_select-label"),
  };

  // Initialize text content and placeholders
  Object.entries(textElements).forEach(([id, key]) => {
    const element = document.getElementById(id);
    if (!element) return;

    if (
      element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement
    ) {
      element.placeholder = chrome.i18n.getMessage(key);
    } else {
      element.textContent = chrome.i18n.getMessage(key);
    }
  });

  // Load API key, target language, mode, and last translation session from storage
  const storageData = await safeStorageGet([
    "geminiApiKey",
    "geminiApiKeys",
    "textTargetLanguage",
    "selectedTextLanguage",
    "lastTranslationSession",
    "currentMode",
  ]);

  const geminiApiKey = storageData.geminiApiKey;
  const geminiApiKeys = storageData.geminiApiKeys || [];
  const textTargetLanguage = storageData.textTargetLanguage || config.DEFAULT_TARGET_LANGUAGE;
  const selectedTextLanguage = storageData.selectedTextLanguage || "English";
  const lastTranslationSession = storageData.lastTranslationSession;
  const currentMode = storageData.currentMode || "translation";

  // Set current mode
  const activeMode = currentMode || "translation";

  // Function to update UI based on selected mode
  function updateModeInterface(mode) {
    const config = modeConfigs[mode];
    if (!config) return;

    // Update placeholders
    elements.textToTranslateTextarea.placeholder = chrome.i18n.getMessage(config.inputPlaceholderKey);
    elements.translatedTextTextarea.placeholder = chrome.i18n.getMessage(config.outputPlaceholderKey);

    // Update button text
    elements.translateTextButton.textContent = chrome.i18n.getMessage(config.buttonTextKey);

    // Update label
    if (elements.selectLabel) {
      elements.selectLabel.textContent = chrome.i18n.getMessage(config.labelKey);
    }

    // Show/hide language selector based on mode
    const languageContainer = elements.textTargetLanguageSelect.parentElement;
    if (languageContainer) {
      languageContainer.style.display = config.showLanguageSelect ? 'flex' : 'none';
    }
  }

  // Initialize interface with current mode
  updateModeInterface(activeMode);

  // Custom dropdown functionality
  const dropdownHeader = elements.modeSelector.querySelector('.aiGeminiTranslator_dropdown-header');
  const dropdownOptions = elements.modeSelector.querySelector('.aiGeminiTranslator_dropdown-options');
  const dropdownTitle = elements.modeSelector.querySelector('.aiGeminiTranslator_dropdown-title');
  const dropdownOptionElements = elements.modeSelector.querySelectorAll('.aiGeminiTranslator_dropdown-option');

  // Check if dropdown elements exist
  if (!dropdownHeader || !dropdownTitle || dropdownOptionElements.length === 0) {
    console.error('Dropdown elements not found');
    return;
  }

  // Function to get localized title for mode
  function getLocalizedModeTitle(mode) {
    const config = modeConfigs[mode];
    return config ? chrome.i18n.getMessage(config.titleKey) : mode;
  }

  // Initialize dropdown with current mode
  function initializeDropdown(mode) {
    console.log('Initializing dropdown with mode:', mode);
    // Localize all dropdown options
    dropdownOptionElements.forEach(opt => {
      const optMode = opt.dataset.value;
      const localizedTitle = getLocalizedModeTitle(optMode);
      console.log(`Mode: ${optMode}, Localized: ${localizedTitle}`);
      opt.textContent = localizedTitle;
      opt.classList.remove('active');
      if (optMode === mode) {
        opt.classList.add('active');
        dropdownTitle.textContent = localizedTitle;
        console.log('Set active mode title:', localizedTitle);
      }
    });
  }

  // Set initial dropdown state
  initializeDropdown(activeMode);

  // Function to get current mode from dropdown
  function getCurrentMode() {
    const activeOption = elements.modeSelector.querySelector('.aiGeminiTranslator_dropdown-option.active');
    return activeOption ? activeOption.dataset.value : 'translation';
  }

  // Toggle dropdown
  dropdownHeader.addEventListener('click', (e) => {
    e.stopPropagation();
    elements.modeSelector.classList.toggle('open');
  });

  // Handle option selection
  dropdownOptionElements.forEach(option => {
    option.addEventListener('click', async (e) => {
      const newMode = e.target.dataset.value;
      const newTitle = getLocalizedModeTitle(newMode);

      // Update active option
      dropdownOptionElements.forEach(opt => opt.classList.remove('active'));
      e.target.classList.add('active');

      // Update dropdown title
      dropdownTitle.textContent = newTitle;

      // Close dropdown
      elements.modeSelector.classList.remove('open');

      // Update interface and save mode
      updateModeInterface(newMode);
      await safeStorageSet({ currentMode: newMode });
    });
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!elements.modeSelector.contains(e.target)) {
      elements.modeSelector.classList.remove('open');
    }
  });

  // Check if we have any API keys (new multi-key system or legacy single key)
  const hasApiKeys =
    (geminiApiKeys && geminiApiKeys.length > 0) || geminiApiKey;

  if (hasApiKeys) {
    // For backward compatibility, show first available key
    const displayKey = geminiApiKey || (geminiApiKeys && geminiApiKeys[0]);
    if (displayKey) {
      apiKey = displayKey;
      elements.apiKeyInput.value = displayKey;
      elements.apiKeyClearIcon.classList.add("active");
      elements.apiKeyStatusIcon.classList.add("valid");
      elements.apiStatusTooltip.textContent = chrome.i18n.getMessage(
        "API_STATUS_VALID_TOOLTIP"
      );
      elements.apiStatusTooltip.style.color = "#4CAF50";
    }
  } else {
    elements.apiStatusTooltip.textContent = chrome.i18n.getMessage(
      "API_STATUS_INVALID_TOOLTIP"
    );
    elements.apiStatusTooltip.style.color = "#F44336";
  }

  elements.textTargetLanguageSelect.value =
    textTargetLanguage || config.DEFAULT_TARGET_LANGUAGE;
  elements.selectedTextLanguageSelect.value = selectedTextLanguage || "English";

  // Restore last translation session if available
  if (lastTranslationSession) {
    elements.textToTranslateTextarea.value =
      lastTranslationSession.originalText || "";
    elements.translatedTextTextarea.value =
      lastTranslationSession.translatedText || "";
    if (lastTranslationSession.targetLanguage) {
      elements.textTargetLanguageSelect.value =
        lastTranslationSession.targetLanguage;
    }
  }

  // Timeout IDs for status messages and session saving
  let apiKeyStatusTimeoutId = null;
  let translationStatusTimeoutId = null;
  let sessionSaveTimeoutId = null;

  // Debounced function to save translation session
  const saveTranslationSession = () => {
    clearTimeout(sessionSaveTimeoutId);
    sessionSaveTimeoutId = setTimeout(async () => {
      await safeStorageSet({
        lastTranslationSession: {
          originalText: elements.textToTranslateTextarea.value,
          translatedText: elements.translatedTextTextarea.value,
          targetLanguage: elements.textTargetLanguageSelect.value,
          timestamp: Date.now(),
        },
      });
    }, 500); // 500ms debounce
  };

  // History management functions
  async function loadTranslationHistory() {
    const storageData = await safeStorageGet(["translationHistory"]);
    const translationHistory = storageData.translationHistory || [];
    renderHistoryList(translationHistory);
  }

  async function addToHistory(
    originalText,
    translatedText,
    targetLanguage,
    sourceLanguage = null
  ) {
    const storageData = await safeStorageGet(["translationHistory"]);
    const translationHistory = storageData.translationHistory || [];

    // Detect source language if not provided
    if (!sourceLanguage) {
      sourceLanguage = elements.selectedTextLanguageSelect.value || "auto";
    }

    // Check if identical translation already exists (avoid duplicates)
    const isDuplicate = translationHistory.some(
      (item) =>
        item.originalText === originalText &&
        item.translatedText === translatedText &&
        item.targetLanguage === targetLanguage &&
        item.sourceLanguage === sourceLanguage
    );

    if (isDuplicate) return;

    const newHistoryItem = {
      id: Date.now().toString(),
      originalText,
      translatedText,
      sourceLanguage,
      targetLanguage,
      timestamp: Date.now(),
    };

    // Add to beginning and limit to 20 items
    const updatedHistory = [newHistoryItem, ...translationHistory].slice(
      0,
      20
    );

    await safeStorageSet({ translationHistory: updatedHistory });
    renderHistoryList(updatedHistory);
  }

  // Selected history items tracking
  let selectedHistoryItems = new Set();

  function renderHistoryList(history) {
    if (!elements.historyList) return;

    elements.historyList.innerHTML = "";

    if (history.length === 0) {
      const emptyMessage = document.createElement("div");
      emptyMessage.className = "aiGeminiTranslator_history-empty";
      emptyMessage.textContent = chrome.i18n.getMessage(
        "HISTORY_EMPTY_MESSAGE"
      );
      elements.historyList.appendChild(emptyMessage);
      updateSelectionButtons();
      return;
    }

    history.forEach((item) => {
      const historyCard = document.createElement("div");
      historyCard.className = "aiGeminiTranslator_history-card";
      historyCard.dataset.itemId = item.id;

      // Add selection checkbox
      const checkbox = document.createElement("div");
      checkbox.className = "aiGeminiTranslator_history-checkbox";
      checkbox.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleHistoryItemSelection(item.id);
      });

      // Content container
      const contentDiv = document.createElement("div");
      contentDiv.className = "aiGeminiTranslator_history-content";

      const originalDiv = document.createElement("div");
      originalDiv.className = "aiGeminiTranslator_history-original";
      originalDiv.textContent =
        item.originalText.length > 25
          ? item.originalText.substring(0, 25) + "..."
          : item.originalText;
      originalDiv.title = item.originalText;

      const translatedDiv = document.createElement("div");
      translatedDiv.className = "aiGeminiTranslator_history-translated";
      translatedDiv.textContent =
        item.translatedText.length > 25
          ? item.translatedText.substring(0, 25) + "..."
          : item.translatedText;
      translatedDiv.title = item.translatedText;

      // Language direction display
      const langDiv = document.createElement("div");
      langDiv.className = "aiGeminiTranslator_history-languages";

      // Get language labels from config
      const getLanguageLabel = (langCode) => {
        const lang = config.LANGUAGES.find((l) => l.value === langCode);
        return lang ? lang.label : langCode;
      };

      const sourceLanguage = item.sourceLanguage || "auto";
      const sourceLangLabel =
        sourceLanguage === "auto" ? "Auto" : getLanguageLabel(sourceLanguage);
      const targetLangLabel = getLanguageLabel(item.targetLanguage);

      langDiv.innerHTML = `
                <span class="aiGeminiTranslator_source-lang">${sourceLangLabel}</span>
                <span class="aiGeminiTranslator_lang-arrow">→</span>
                <span class="aiGeminiTranslator_target-lang">${targetLangLabel}</span>
            `;

      contentDiv.appendChild(originalDiv);
      contentDiv.appendChild(translatedDiv);
      contentDiv.appendChild(langDiv);

      historyCard.appendChild(checkbox);
      historyCard.appendChild(contentDiv);

      // Add click handler for content restoration
      contentDiv.addEventListener("click", () => restoreFromHistory(item));

      // Apply selection state
      if (selectedHistoryItems.has(item.id)) {
        historyCard.classList.add("selected");
        checkbox.classList.add("checked");
      }

      elements.historyList.appendChild(historyCard);
    });

    updateSelectionButtons();
  }

  function restoreFromHistory(historyItem) {
    elements.textToTranslateTextarea.value = historyItem.originalText;
    elements.translatedTextTextarea.value = historyItem.translatedText;
    elements.textTargetLanguageSelect.value = historyItem.targetLanguage;

    // Save restored session
    saveTranslationSession();
  }

  function toggleHistoryItemSelection(itemId) {
    if (selectedHistoryItems.has(itemId)) {
      selectedHistoryItems.delete(itemId);
    } else {
      selectedHistoryItems.add(itemId);
    }

    // Update visual state
    const card = document.querySelector(`[data-item-id="${itemId}"]`);
    if (card) {
      const checkbox = card.querySelector(
        ".aiGeminiTranslator_history-checkbox"
      );
      card.classList.toggle("selected");
      checkbox.classList.toggle("checked");
    }

    updateSelectionButtons();
  }

  function updateSelectionButtons() {
    const hasSelection = selectedHistoryItems.size > 0;
    const historyCards = elements.historyList.querySelectorAll(
      ".aiGeminiTranslator_history-card[data-item-id]"
    );
    const totalItems = historyCards.length;
    const hasItems = totalItems > 0;

    elements.deleteSelectedButton.disabled = !hasSelection;
    elements.selectAllButton.disabled = !hasItems;

    // Update select all button text
    if (hasItems) {
      const allSelected =
        selectedHistoryItems.size === totalItems && totalItems > 0;
      elements.selectAllButton.textContent = allSelected
        ? chrome.i18n.getMessage("HISTORY_DESELECT_ALL_BUTTON_TEXT")
        : chrome.i18n.getMessage("HISTORY_SELECT_ALL_BUTTON_TEXT");
    }
  }

  function selectAllHistoryItems() {
    const historyCards = elements.historyList.querySelectorAll(
      ".aiGeminiTranslator_history-card[data-item-id]"
    );
    const allSelected =
      selectedHistoryItems.size === historyCards.length &&
      historyCards.length > 0;

    if (allSelected) {
      // Deselect all
      selectedHistoryItems.clear();
      historyCards.forEach((card) => {
        card.classList.remove("selected");
        const checkbox = card.querySelector(
          ".aiGeminiTranslator_history-checkbox"
        );
        if (checkbox) checkbox.classList.remove("checked");
      });
    } else {
      // Select all
      historyCards.forEach((card) => {
        const itemId = card.dataset.itemId;
        if (itemId) {
          selectedHistoryItems.add(itemId);
          card.classList.add("selected");
          const checkbox = card.querySelector(
            ".aiGeminiTranslator_history-checkbox"
          );
          if (checkbox) checkbox.classList.add("checked");
        }
      });
    }

    updateSelectionButtons();
  }

  async function deleteSelectedHistoryItems() {
    if (selectedHistoryItems.size === 0) return;

    const storageData = await safeStorageGet(["translationHistory"]);
    const translationHistory = storageData.translationHistory || [];

    // Filter out selected items
    const updatedHistory = translationHistory.filter(
      (item) => !selectedHistoryItems.has(item.id)
    );

    await safeStorageSet({ translationHistory: updatedHistory });

    // Clear selection
    selectedHistoryItems.clear();

    // Re-render list
    renderHistoryList(updatedHistory);
  }

  function updateStatus(messageKey, color) {
    elements.apiKeyStatus.textContent = chrome.i18n.getMessage(messageKey);
    elements.apiKeyStatus.style.color = color;

    if (color === "green") {
      elements.apiKeyStatusIcon.classList.add("valid");
      elements.apiKeyStatusIcon.classList.remove("invalid");
      elements.apiKeyClearIcon.style.display = "block";
    } else {
      elements.apiKeyStatusIcon.classList.add("invalid");
      elements.apiKeyStatusIcon.classList.remove("valid");
      elements.apiKeyClearIcon.style.display = "none";
    }

    // Automatyczne chowanie komunikatu tekstowego
    elements.apiKeyStatus.style.display = "block";
    clearTimeout(apiKeyStatusTimeoutId);
    apiKeyStatusTimeoutId = setTimeout(() => {
      elements.apiKeyStatus.style.display = "none";
    }, 5000);

    // Aktualizuj treść i kolor tooltipa
    const hasValidApiKey = color === "green";
    elements.apiStatusTooltip.textContent = hasValidApiKey
      ? chrome.i18n.getMessage("API_STATUS_VALID_TOOLTIP")
      : chrome.i18n.getMessage("API_STATUS_INVALID_TOOLTIP");
    elements.apiStatusTooltip.style.color = hasValidApiKey
      ? "#4CAF50"
      : "#F44336";

    // Aktualizuj klasę ikony statusu
    elements.apiKeyStatusIcon.classList.toggle("valid", hasValidApiKey);
    elements.apiKeyStatusIcon.classList.toggle("invalid", !hasValidApiKey);
  }

  function updateTranslationStatus(messageKey, color) {
    elements.textTranslationStatus.textContent =
      chrome.i18n.getMessage(messageKey);
    elements.textTranslationStatus.style.color = color;
    elements.textTranslationStatus.style.display = "block";

    clearTimeout(translationStatusTimeoutId);
    translationStatusTimeoutId = setTimeout(
      () => {
        elements.textTranslationStatus.style.display = "none";
      },
      color === "green" ? 3000 : 5000
    );
  }

  async function translateText() {
    const text = elements.textToTranslateTextarea.value.trim();
    const targetLanguage = elements.textTargetLanguageSelect.value;
    const currentMode = getCurrentMode();

    if (!text)
      return updateTranslationStatus("TEXT_TO_TRANSLATE_EMPTY_MESSAGE", "red");

    updateTranslationStatus("TRANSLATION_IN_PROGRESS_MESSAGE", "yellow");
    elements.translatedTextTextarea.value = "";

    try {
      // Use background script with ApiKeyManager and mode
      const response = await chrome.runtime.sendMessage({
        action: "processText",
        text: text,
        targetLanguage: targetLanguage,
        mode: currentMode,
      });

      if (response && response.translatedText) {
        // Check if it's an error message
        if (response.translatedText.startsWith("Translation failed:")) {
          updateTranslationStatus(response.translatedText, "red");
          return;
        }

        elements.translatedTextTextarea.value = response.translatedText;
        updateTranslationStatus("TRANSLATION_COMPLETE_MESSAGE", "green");

        // Save session after successful translation
        saveTranslationSession();

        // Add to history after successful translation
        await addToHistory(
          elements.textToTranslateTextarea.value,
          response.translatedText,
          elements.textTargetLanguageSelect.value,
          elements.selectedTextLanguageSelect.value
        );
      } else {
        updateTranslationStatus("TRANSLATION_FAILED_MESSAGE", "red");
      }
    } catch (error) {
      console.error("Translation error:", error);
      updateTranslationStatus("TRANSLATION_FAILED_MESSAGE", "red");
    }
  }

  async function translateSelectedTextInPopup(selectedText) {
    const targetLanguage = elements.textTargetLanguageSelect.value;
    const currentMode = getCurrentMode();

    if (!selectedText) return;

    // Show that translation is in progress for selected text
    updateTranslationStatus("TRANSLATION_IN_PROGRESS_MESSAGE", "yellow");

    try {
      // Use background script with ApiKeyManager and mode
      const response = await chrome.runtime.sendMessage({
        action: "processText",
        text: selectedText,
        targetLanguage: targetLanguage,
        mode: currentMode,
      });

      if (response && response.translatedText) {
        // Check if it's an error message
        if (response.translatedText.startsWith("Translation failed:")) {
          updateTranslationStatus(response.translatedText, "red");
          return;
        }

        // Replace the current translated text with selection translation
        elements.translatedTextTextarea.value = response.translatedText;
        updateTranslationStatus("TRANSLATION_COMPLETE_MESSAGE", "green");

        // Add to history
        await addToHistory(
          selectedText,
          response.translatedText,
          targetLanguage,
          elements.selectedTextLanguageSelect.value
        );
      } else {
        updateTranslationStatus("TRANSLATION_FAILED_MESSAGE", "red");
      }
    } catch (error) {
      console.error("Translation error:", error);
      updateTranslationStatus("TRANSLATION_FAILED_MESSAGE", "red");
    }
  }

  function showCopyStatus(message, color) {
    const tooltip = document.querySelector(".aiGeminiTranslator_copy-tooltip");
    if (!tooltip) {
      console.error("Tooltip element not found!");
      return;
    }
    tooltip.textContent = message;
    tooltip.style.color = color;
    tooltip.classList.add("visible");

    setTimeout(() => {
      tooltip.classList.remove("visible");
    }, 2000);
  }

  const initializeSelects = async () => {
    const storageData = await safeStorageGet([
      "textTargetLanguage",
      "selectedTextLanguage",
    ]);

    const textTargetLanguage = storageData.textTargetLanguage || systemLanguage;
    const selectedTextLanguage = storageData.selectedTextLanguage || systemLanguage;

    [
      elements.textTargetLanguageSelect,
      elements.selectedTextLanguageSelect,
    ].forEach((select, index) => {
      select.innerHTML = config.LANGUAGES.map(
        (lang) =>
          `<option value="${lang.value}" ${lang.value === (index ? selectedTextLanguage : textTargetLanguage)
            ? "selected"
            : ""
          }>
                    ${lang.label}
                </option>`
      ).join("");
    });
  };

  const setupEventListeners = () => {
    const handlers = {
      "input #apiKeyInput": handleApiKeyInput,
      "click #saveButton": handleSaveApiKey,
      "change .language-select": handleLanguageChange,
    };

    Object.entries(handlers).forEach(([event, handler]) => {
      const [eventType, selector] = event.split(" ");
      document.querySelector(selector).addEventListener(eventType, handler);
    });
  };

  function updateLanguageSwitcher() {
    const langSelect = document.getElementById("language-switcher");
    langSelect.innerHTML = Object.keys(chrome.i18n.getAcceptLanguages())
      .map((lang) => `<option value="${lang}">${lang}</option>`)
      .join("");

    langSelect.addEventListener("change", () => {
      safeStorageSet({ preferredLanguage: langSelect.value });
      window.location.reload();
    });
  }

  // API Keys Management Functions
  function showStatus(element, message, type = "info") {
    element.textContent = message;
    element.style.display = "block";

    // Set color based on type
    switch (type) {
      case "success":
        element.style.color = "#4caf50";
        break;
      case "error":
        element.style.color = "#f44336";
        break;
      case "warning":
        element.style.color = "#ff9800";
        break;
      default:
        element.style.color = "#2196f3";
    }

    // Auto hide after 3 seconds
    setTimeout(() => {
      element.style.display = "none";
    }, 3000);
  }

  async function removeApiKey(index) {
    if (!confirm("Are you sure you want to remove this API key?")) {
      return;
    }

    const storageData = await safeStorageGet(["geminiApiKeys"]);
    const geminiApiKeys = storageData.geminiApiKeys || [];
    const updatedKeys = geminiApiKeys.filter((_, i) => i !== index);

    const success = await safeStorageSet({ geminiApiKeys: updatedKeys });
    if (success) {
      await loadApiKeys();
      showStatus(
        elements.apiKeyStatus,
        `API key removed. Remaining: ${updatedKeys.length}`,
        "success"
      );
    } else {
      showStatus(elements.apiKeyStatus, "Failed to remove API key", "error");
    }
  }

  async function loadApiKeys() {
    const storageData = await safeStorageGet(["geminiApiKeys"]);
    const geminiApiKeys = storageData.geminiApiKeys || [];
    renderApiKeysList(geminiApiKeys);
    return geminiApiKeys;
  }

  function renderApiKeysList(apiKeys) {
    elements.apiKeysContainer.innerHTML = "";

    if (apiKeys.length === 0) {
      const emptyState = document.createElement("div");
      emptyState.className = "aiGeminiTranslator_empty-state";
      emptyState.innerHTML = `
                <div style="color: #888; font-size: 0.8rem; text-align: center; padding: 20px; border: 1px dashed #424242; border-radius: 4px; background-color: #252525;">
                    <div style="margin-bottom: 8px;">🔑</div>
                    <div>No API keys added yet</div>
                    <div style="font-size: 0.7rem; color: #666; margin-top: 4px;">Add your first API key above</div>
                </div>
            `;
      elements.apiKeysContainer.appendChild(emptyState);
      return;
    }

    apiKeys.forEach((key, index) => {
      const keyItem = createApiKeyItem(key, index);
      elements.apiKeysContainer.appendChild(keyItem);
    });
  }

  function createApiKeyItem(apiKey, index) {
    const item = document.createElement("div");
    item.className = "aiGeminiTranslator_api-key-item healthy";
    item.dataset.index = index;

    const maskedKey =
      apiKey.substring(0, 8) + "..." + apiKey.substring(apiKey.length - 4);

    item.innerHTML = `
            <div class="aiGeminiTranslator_api-key-info">
                <div class="aiGeminiTranslator_api-key-display">${maskedKey}</div>
                <div class="aiGeminiTranslator_api-key-status-text healthy">Ready</div>
            </div>
            <button class="aiGeminiTranslator_api-key-remove" title="Remove API Key">×</button>
        `;

    // Add remove functionality
    const removeButton = item.querySelector(
      ".aiGeminiTranslator_api-key-remove"
    );
    removeButton.addEventListener("click", () => removeApiKey(index));

    return item;
  }

  async function addApiKey() {
    const newKey = elements.apiKeyInput.value.trim();

    if (!newKey) {
      showStatus(
        elements.apiKeyStatus,
        chrome.i18n.getMessage("API_KEY_EMPTY_MESSAGE"),
        "error"
      );
      return;
    }

    // Validate API key format (improved check)
    if (!isValidApiKeyFormat(newKey)) {
      showStatus(elements.apiKeyStatus, "Invalid API key format", "error");
      return;
    }

    const storageData = await safeStorageGet(["geminiApiKeys"]);
    const geminiApiKeys = storageData.geminiApiKeys || [];

    // Check if key already exists
    if (geminiApiKeys.includes(newKey)) {
      showStatus(elements.apiKeyStatus, "API key already exists", "error");
      return;
    }

    // Test API key before adding
    showStatus(elements.apiKeyStatus, "Testing API key...", "info");

    const isValid = await testApiKey(newKey);
    if (!isValid) {
      showStatus(
        elements.apiKeyStatus,
        "API key test failed - invalid key",
        "error"
      );
      return;
    }

    // Add new key
    const updatedKeys = [...geminiApiKeys, newKey];
    const success = await safeStorageSet({ geminiApiKeys: updatedKeys });

    if (!success) {
      showStatus(elements.apiKeyStatus, "Failed to save API key", "error");
      return;
    }

    // Also set as legacy single key for backward compatibility
    if (geminiApiKeys.length === 0) {
      await safeStorageSet({ geminiApiKey: newKey });
      apiKey = newKey;
      elements.apiKeyClearIcon.classList.add("active");
      elements.apiKeyStatusIcon.classList.add("valid");
      elements.apiStatusTooltip.textContent = chrome.i18n.getMessage(
        "API_STATUS_VALID_TOOLTIP"
      );
      elements.apiStatusTooltip.style.color = "#4CAF50";
    }

    // Clear input and refresh list
    elements.apiKeyInput.value = "";
    await loadApiKeys();

    showStatus(
      elements.apiKeyStatus,
      `API key validated and added! Total: ${updatedKeys.length}`,
      "success"
    );
  }

  // Validate API key format function
  function isValidApiKeyFormat(key) {
    // Google API keys typically start with "AIza" and are 39 characters long
    // But some might have different patterns, so we'll be more flexible
    if (key.startsWith("AIza") && key.length === 39) {
      return true;
    }

    // Alternative pattern: check for alphanumeric characters, underscores, hyphens
    // Length should be between 30-50 characters for most Google API keys
    if (key.length >= 30 && key.length <= 50 && /^[A-Za-z0-9_-]+$/.test(key)) {
      return true;
    }

    return false;
  }

  // Test API key function with timeout
  async function testApiKey(key) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const testResponse = await fetch(`${config.API_URL}?key=${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: "Test" }],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 5,
          },
        }),
      });

      clearTimeout(timeoutId);

      // Check if response is successful (not rate limited or invalid)
      if (testResponse.ok) {
        const result = await testResponse.json();
        return result && result.candidates && result.candidates.length > 0;
      } else if (testResponse.status === 400) {
        // 400 might indicate invalid key or malformed request
        const errorData = await testResponse.json();
        console.warn("API key test error:", errorData);

        // If error is about API key being invalid, return false
        if (
          errorData.error &&
          errorData.error.message &&
          errorData.error.message.toLowerCase().includes("api key")
        ) {
          return false;
        }

        // Other 400 errors might be request format issues, key could still be valid
        return true;
      } else if (testResponse.status === 429) {
        // Rate limited, but key might be valid
        console.warn("API key rate limited during test, assuming valid");
        return true;
      } else if (testResponse.status === 403) {
        // Forbidden - likely invalid key
        console.warn("API key test forbidden - likely invalid key");
        return false;
      } else {
        console.warn("API key test unexpected status:", testResponse.status);
        return false;
      }
    } catch (error) {
      if (error.name === "AbortError") {
        console.warn("API key test timed out");
        return false;
      }
      console.error("API key test failed:", error);
      return false;
    }
  }

  function showApiStatusModal(statusList) {
    // Create modal if it doesn't exist
    let modal = document.getElementById("aiGeminiTranslator_api-status-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "aiGeminiTranslator_api-status-modal";
      modal.className = "aiGeminiTranslator_api-status-modal";

      modal.innerHTML = `
                <div class="aiGeminiTranslator_api-status-content">
                    <div class="aiGeminiTranslator_api-status-header">
                        <h3>API Keys Status</h3>
                        <button class="aiGeminiTranslator_api-status-close">×</button>
                    </div>
                    <div id="aiGeminiTranslator_api-status-body"></div>
                </div>
            `;

      document.body.appendChild(modal);

      // Add close functionality
      modal
        .querySelector(".aiGeminiTranslator_api-status-close")
        .addEventListener("click", () => {
          modal.classList.add("hidden");
        });

      modal.addEventListener("click", (e) => {
        if (e.target === modal) {
          modal.classList.add("hidden");
        }
      });
    }

    // Update content
    const body = modal.querySelector("#aiGeminiTranslator_api-status-body");
    body.innerHTML = "";

    if (statusList.length === 0) {
      body.innerHTML =
        '<div style="text-align: center; color: #666; padding: 20px;">No API keys configured</div>';
    } else {
      statusList.forEach((status) => {
        const statusItem = document.createElement("div");
        statusItem.className = `aiGeminiTranslator_api-key-item ${status.healthy
          ? "healthy"
          : status.isRateLimited
            ? "rate-limited"
            : "error"
          }`;

        let statusText = "Ready";
        if (status.isRateLimited) {
          statusText = `Rate limited (${status.rateLimitEndsIn}s)`;
        } else if (!status.healthy) {
          statusText = `Error (${status.errorCount} failures)`;
        }

        statusItem.innerHTML = `
                    <div class="aiGeminiTranslator_api-key-info">
                        <div class="aiGeminiTranslator_api-key-display">Key #${status.index
          }: ${status.key}</div>
                        <div class="aiGeminiTranslator_api-key-status-text ${status.healthy
            ? "healthy"
            : status.isRateLimited
              ? "rate-limited"
              : "error"
          }">
                            ${statusText}
                        </div>
                    </div>
                `;

        body.appendChild(statusItem);
      });
    }

    modal.classList.remove("hidden");
  }

  async function showApiKeysStatus() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: "getApiKeyStatus",
      });

      if (response.error) {
        showStatus(elements.apiKeyStatus, response.error, "error");
        return;
      }

      showApiStatusModal(response.status);
    } catch (error) {
      console.error("Failed to get API key status:", error);
      showStatus(
        elements.apiKeyStatus,
        "Failed to get API key status",
        "error"
      );
    }
  }

  // Event listeners
  elements.settingsHeader.addEventListener("click", (e) => {
    e.preventDefault();
    elements.settingsCard.classList.toggle("collapsed");
  });

  elements.apiKeyInput.addEventListener("input", () => {
    elements.apiKeyClearIcon.classList.toggle(
      "active",
      !!elements.apiKeyInput.value.trim()
    );
  });

  elements.apiKeyClearIcon.addEventListener("click", async () => {
    elements.apiKeyClearIcon.classList.remove("active");
    setTimeout(async () => {
      await safeStorageRemove("geminiApiKey");
      elements.apiKeyInput.value = "";
      elements.apiKeyStatusIcon.classList.remove("valid");
    }, 300);
  });

  elements.saveApiKeyButton.addEventListener("click", addApiKey);

  elements.showApiStatusButton.addEventListener("click", showApiKeysStatus);

  elements.translateTextButton.addEventListener("click", translateText);

  // Add OCR test button
  const ocrTestButton = document.getElementById("aiGeminiTranslator_test-ocr-button");
  if (ocrTestButton) {
    ocrTestButton.addEventListener("click", async () => {
      // Send message to content script to start OCR mode
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      chrome.tabs.sendMessage(tab.id, { action: "startOCRMode" });
      window.close(); // Close popup
    });
  }

  elements.textTargetLanguageSelect.addEventListener("change", async () => {
    await safeStorageSet({
      textTargetLanguage: elements.textTargetLanguageSelect.value,
    });
    saveTranslationSession(); // Save session when target language changes
  });

  // Add auto-save event listeners for textareas
  elements.textToTranslateTextarea.addEventListener(
    "input",
    saveTranslationSession
  );
  elements.translatedTextTextarea.addEventListener(
    "input",
    saveTranslationSession
  );

  // History event listeners
  elements.selectAllButton.addEventListener("click", selectAllHistoryItems);
  elements.deleteSelectedButton.addEventListener(
    "click",
    deleteSelectedHistoryItems
  );

  elements.copyIcon.addEventListener("click", async () => {
    const textToCopy = elements.translatedTextTextarea.value;

    if (!textToCopy) {
      showCopyStatus(
        chrome.i18n.getMessage("COPY_NO_TEXT_MESSAGE"),
        "var(--copy-error-color)"
      );
      return;
    }

    try {
      await navigator.clipboard.writeText(textToCopy);
      showCopyStatus(
        chrome.i18n.getMessage("COPY_SUCCESS_MESSAGE"),
        "var(--text-color)"
      );
    } catch (err) {
      console.error("Failed to copy text:", err);
      showCopyStatus(
        chrome.i18n.getMessage("COPY_FAILED_MESSAGE"),
        "var(--copy-error-color)"
      );
    }
  });

  elements.copyIcon.title = chrome.i18n.getMessage("COPY_ICON_TOOLTIP");

  elements.selectedTextLanguageSelect.addEventListener("change", async () => {
    const newValue = elements.selectedTextLanguageSelect.value;
    await safeStorageSet({ selectedTextLanguage: newValue });

    // Zaktualizuj widok selecta
    initializeSelects();
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local") {
      if (changes.geminiApiKey) {
        elements.apiKeyInput.value = changes.geminiApiKey.newValue || "";
        elements.apiKeyClearIcon.classList.toggle(
          "active",
          !!changes.geminiApiKey.newValue
        );
      }
      if (changes.textTargetLanguage)
        elements.textTargetLanguageSelect.value =
          changes.textTargetLanguage.newValue;
      if (changes.apiKeyStatus) {
        const icon =
          changes.apiKeyStatus.newValue === "valid" ? "valid" : "invalid";
        elements.apiKeyStatusIcon.classList.toggle("valid", icon === "valid");
        elements.apiKeyStatusIcon.classList.toggle(
          "invalid",
          icon === "invalid"
        );
      }
      if (changes.selectedTextLanguage)
        elements.selectedTextLanguageSelect.value =
          changes.selectedTextLanguage.newValue;
    }
  });

  elements.textToTranslateTextarea.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      translateText();
    }
  });

  // Add selection translation functionality
  elements.textToTranslateTextarea.addEventListener("mouseup", (e) => {
    const selection = elements.textToTranslateTextarea.value
      .substring(
        elements.textToTranslateTextarea.selectionStart,
        elements.textToTranslateTextarea.selectionEnd
      )
      .trim();

    if (
      selection &&
      selection !== elements.textToTranslateTextarea.value.trim()
    ) {
      // Only translate selection if it's different from full text
      translateSelectedTextInPopup(selection);
    }
  });

  elements.textToTranslateTextarea.addEventListener("keyup", (e) => {
    // Handle keyboard selection (Shift + arrows, Ctrl+A, etc.)
    if (e.shiftKey || e.ctrlKey) {
      const selection = elements.textToTranslateTextarea.value
        .substring(
          elements.textToTranslateTextarea.selectionStart,
          elements.textToTranslateTextarea.selectionEnd
        )
        .trim();

      if (
        selection &&
        selection !== elements.textToTranslateTextarea.value.trim()
      ) {
        translateSelectedTextInPopup(selection);
      }
    }
  });

  // Initialize UI components
  await Promise.all([
    initializeSelects(),
    loadApiKeys(),
    loadTranslationHistory(),
  ]);

  // Set up CSS variables
  document.documentElement.style.setProperty(
    "--valid-icon",
    `url("${config.VALID_ICON_SVG}")`
  );
  document.documentElement.style.setProperty(
    "--invalid-icon",
    `url("${config.INVALID_ICON_SVG}")`
  );
  document.documentElement.style.setProperty(
    "--copy-icon",
    `url("${config.COPY_ICON_SVG}")`
  );
  document.documentElement.style.setProperty("--copy-error-color", "#ff4444");
});
