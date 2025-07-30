export class Translator {
  constructor(elements, historyManager) {
    this.elements = elements;
    this.historyManager = historyManager;
    this.translationStatusTimeoutId = null;
    this.init();
  }

  init() {
    this.setupEventListeners();
  }

  setupEventListeners() {
    if (this.elements.translateTextButton) {
      this.elements.translateTextButton.addEventListener('click', () => {
        this.translateText();
      });
    }

    if (this.elements.copyTextButton) {
      this.elements.copyTextButton.addEventListener('click', () => {
        this.copyTranslatedText();
      });
    }

    if (this.elements.textToTranslateTextarea) {
      this.elements.textToTranslateTextarea.addEventListener('keydown', (e) => {
        // Translate on Ctrl+Enter or Cmd+Enter
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault();
          this.translateText();
        }
      });
    }
  }

  getCurrentMode() {
    const activeOption = this.elements.modeSelector.querySelector('.aiGeminiTranslator_dropdown-option.active');
    return activeOption ? activeOption.dataset.value : 'translation';
  }

  async translateText() {
    const text = this.elements.textToTranslateTextarea.value.trim();
    const targetLanguage = this.elements.textTargetLanguageSelect.value;
    const currentMode = this.getCurrentMode();

    if (!text) {
      return this.updateTranslationStatus("TEXT_TO_TRANSLATE_EMPTY_MESSAGE", "red");
    }

    this.updateTranslationStatus("TRANSLATION_IN_PROGRESS_MESSAGE", "yellow");
    this.elements.translatedTextTextarea.value = "";

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
          this.updateTranslationStatus(response.translatedText, "red");
          return;
        }

        this.elements.translatedTextTextarea.value = response.translatedText;
        this.updateTranslationStatus("TRANSLATION_COMPLETE_MESSAGE", "green");

        // Save session after successful translation
        this.saveTranslationSession();

        // Add to history after successful translation
        await this.historyManager.addToHistory(
          this.elements.textToTranslateTextarea.value,
          response.translatedText,
          this.elements.textTargetLanguageSelect.value,
          this.elements.selectedTextLanguageSelect.value
        );
      } else {
        this.updateTranslationStatus("TRANSLATION_FAILED_MESSAGE", "red");
      }
    } catch (error) {
      console.error("Translation error:", error);
      this.updateTranslationStatus("TRANSLATION_FAILED_MESSAGE", "red");
    }
  }

  async translateSelectedTextInPopup(selectedText) {
    const targetLanguage = this.elements.textTargetLanguageSelect.value;
    const currentMode = this.getCurrentMode();

    if (!selectedText) return;

    // Show that translation is in progress for selected text
    this.updateTranslationStatus("TRANSLATION_IN_PROGRESS_MESSAGE", "yellow");

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
          this.updateTranslationStatus(response.translatedText, "red");
          return;
        }

        // Replace the current translated text with selection translation
        this.elements.translatedTextTextarea.value = response.translatedText;
        this.updateTranslationStatus("TRANSLATION_COMPLETE_MESSAGE", "green");

        // Add to history
        await this.historyManager.addToHistory(
          selectedText,
          response.translatedText,
          targetLanguage,
          this.elements.selectedTextLanguageSelect.value
        );
      } else {
        this.updateTranslationStatus("TRANSLATION_FAILED_MESSAGE", "red");
      }
    } catch (error) {
      console.error("Translation error:", error);
      this.updateTranslationStatus("TRANSLATION_FAILED_MESSAGE", "red");
    }
  }

  updateTranslationStatus(messageKey, color) {
    this.elements.textTranslationStatus.textContent = chrome.i18n.getMessage(messageKey);
    this.elements.textTranslationStatus.style.color = color;
    this.elements.textTranslationStatus.style.display = "block";

    clearTimeout(this.translationStatusTimeoutId);
    this.translationStatusTimeoutId = setTimeout(
      () => {
        this.elements.textTranslationStatus.style.display = "none";
      },
      color === "green" ? 3000 : 5000
    );
  }

  async copyTranslatedText() {
    const translatedText = this.elements.translatedTextTextarea.value.trim();
    
    if (!translatedText) {
      this.showCopyStatus(chrome.i18n.getMessage("COPY_NO_TEXT_MESSAGE"), "#ff9800");
      return;
    }

    try {
      await navigator.clipboard.writeText(translatedText);
      this.showCopyStatus(chrome.i18n.getMessage("COPY_SUCCESS_MESSAGE"), "#4caf50");
    } catch (error) {
      console.error("Copy failed:", error);
      this.showCopyStatus(chrome.i18n.getMessage("COPY_FAILED_MESSAGE"), "#f44336");
    }
  }

  showCopyStatus(message, color) {
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

  saveTranslationSession() {
    // This method should be implemented in the main popup file
    // or passed as a callback to avoid circular dependencies
    console.log('saveTranslationSession called from Translator');
  }
}