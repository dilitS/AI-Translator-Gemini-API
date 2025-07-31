import config from "../background/config.js";
import { textElements, modeConfigs } from './utils/constants.js';
import { safeStorageGet, safeStorageSet } from './utils/storage.js';
import { updateModeInterface } from './utils/ui.js';
import { ModeSelector } from './components/modeSelector.js';
import { HistoryManager } from './components/historyManager.js';
import { ApiKeyManager } from './components/apiKeyManager.js';
import { Translator } from './components/translator.js';
import { LanguageManager } from './utils/languageManager.js';

document.addEventListener("DOMContentLoaded", async () => {
  // Get DOM elements
  const elements = {
    modeSelector: document.getElementById("aiGeminiTranslator_mode-selector"),
    apiKeyInput: document.getElementById("aiGeminiTranslator_api-key-input"),
    saveApiKeyButton: document.getElementById("aiGeminiTranslator_save-api-key-button"),
    showApiStatusButton: document.getElementById("aiGeminiTranslator_show-api-status-button"),
    textToTranslateTextarea: document.getElementById("aiGeminiTranslator_text-to-translate"),
    translatedTextTextarea: document.getElementById("aiGeminiTranslator_translated-text"),
    textTargetLanguageSelect: document.getElementById("aiGeminiTranslator_text-target-language"),
    translateTextButton: document.getElementById("aiGeminiTranslator_translate-text-button"),
    apiKeyStatus: document.getElementById("aiGeminiTranslator_api-key-status"),
    textTranslationStatus: document.getElementById("aiGeminiTranslator_text-translation-status"),
    settingsCard: document.querySelector(".aiGeminiTranslator_card.collapsed"),
    settingsHeader: document.querySelector("#settingsHeader"),
    apiKeyStatusIcon: document.querySelector(".aiGeminiTranslator_api-key-status-icon"),
    apiKeyClearIcon: document.querySelector(".aiGeminiTranslator_api-key-clear-icon"),
    copyIcon: document.querySelector(".aiGeminiTranslator_copy-icon"),
    apiStatusTooltip: document.querySelector(".aiGeminiTranslator_api-status-tooltip"),
    selectedTextLanguageSelect: document.getElementById("aiGeminiTranslator_selected-text-language"),
    statusElement: document.getElementById("aiGeminiTranslator_status"),
    historyList: document.getElementById("aiGeminiTranslator_history-list"),
    selectAllButton: document.getElementById("aiGeminiTranslator_select-all-button"),
    deleteSelectedButton: document.getElementById("aiGeminiTranslator_delete-selected-button"),
    apiKeysContainer: document.getElementById("aiGeminiTranslator_api-keys-container"),
    selectLabel: document.getElementById("aiGeminiTranslator_select-label"),
    ocrButton: document.getElementById("aiGeminiTranslator_test-ocr-button"),
  };

  // Initialize text content and placeholders
  Object.entries(textElements).forEach(([id, key]) => {
    const element = document.getElementById(id);
    if (!element) return;

    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      element.placeholder = chrome.i18n.getMessage(key);
    } else {
      element.textContent = chrome.i18n.getMessage(key);
    }
  });

  // Load stored data
  const storageData = await safeStorageGet([
    "geminiApiKey",
    "geminiApiKeys", 
    "textTargetLanguage",
    "selectedTextLanguage",
    "lastTranslationSession",
    "currentMode",
  ]);

  const currentMode = storageData.currentMode || "translation";

  // Initialize components
  const historyManager = new HistoryManager(elements);
  const apiKeyManager = new ApiKeyManager(elements);
  const translator = new Translator(elements, historyManager);
  const languageManager = new LanguageManager(elements);
  const modeSelector = new ModeSelector(elements);

  // Initialize interface with current mode
  updateModeInterface(currentMode, elements);
  modeSelector.initializeDropdown(currentMode);

  // Set target language
  const textTargetLanguage = storageData.textTargetLanguage || config.DEFAULT_TARGET_LANGUAGE;
  const selectedTextLanguage = storageData.selectedTextLanguage || "English";
  
  if (elements.textTargetLanguageSelect) {
    elements.textTargetLanguageSelect.value = textTargetLanguage;
  }
  if (elements.selectedTextLanguageSelect) {
    elements.selectedTextLanguageSelect.value = selectedTextLanguage;
  }

  // Restore last translation session if available
  const lastTranslationSession = storageData.lastTranslationSession;
  if (lastTranslationSession) {
    elements.textToTranslateTextarea.value = lastTranslationSession.originalText || "";
    elements.translatedTextTextarea.value = lastTranslationSession.translatedText || "";
    if (lastTranslationSession.targetLanguage) {
      elements.textTargetLanguageSelect.value = lastTranslationSession.targetLanguage;
    }
  }

  // Session management
  let sessionSaveTimeoutId = null;

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

  // Add session saving to components
  translator.saveTranslationSession = saveTranslationSession;
  historyManager.saveTranslationSession = saveTranslationSession;

  // Setup session saving on text changes
  elements.textToTranslateTextarea.addEventListener('input', saveTranslationSession);
  elements.translatedTextTextarea.addEventListener('input', saveTranslationSession);
  elements.textTargetLanguageSelect.addEventListener('change', saveTranslationSession);

  // Setup settings card toggle
  if (elements.settingsHeader) {
    elements.settingsHeader.addEventListener('click', () => {
      if (elements.settingsCard) {
        elements.settingsCard.classList.toggle('collapsed');
      }
    });
  }

  console.log('Popup initialized successfully');

  if (elements.ocrButton) {
    elements.ocrButton.addEventListener("click", async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        chrome.tabs.sendMessage(tab.id, { action: "startOCRMode" });
        window.close();
      }
    });
  }

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
      translator.translateSelectedTextInPopup(selection);
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
        translator.translateSelectedTextInPopup(selection);
      }
    }
  });
});