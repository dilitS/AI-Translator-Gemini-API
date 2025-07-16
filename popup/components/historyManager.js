import config from "../../background/config.js";
import { safeStorageGet, safeStorageSet } from '../utils/storage.js';

export class HistoryManager {
  constructor(elements) {
    this.elements = elements;
    this.selectedHistoryItems = new Set();
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.loadTranslationHistory();
  }

  setupEventListeners() {
    if (this.elements.selectAllButton) {
      this.elements.selectAllButton.addEventListener('click', () => {
        this.selectAllHistoryItems();
      });
    }

    if (this.elements.deleteSelectedButton) {
      this.elements.deleteSelectedButton.addEventListener('click', () => {
        this.deleteSelectedHistoryItems();
      });
    }
  }

  async loadTranslationHistory() {
    const storageData = await safeStorageGet(["translationHistory"]);
    const translationHistory = storageData.translationHistory || [];
    this.renderHistoryList(translationHistory);
  }

  async addToHistory(originalText, translatedText, targetLanguage, sourceLanguage = null) {
    const storageData = await safeStorageGet(["translationHistory"]);
    const translationHistory = storageData.translationHistory || [];

    // Detect source language if not provided
    if (!sourceLanguage) {
      sourceLanguage = this.elements.selectedTextLanguageSelect.value || "auto";
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
    const updatedHistory = [newHistoryItem, ...translationHistory].slice(0, 20);

    await safeStorageSet({ translationHistory: updatedHistory });
    this.renderHistoryList(updatedHistory);
  }

  renderHistoryList(history) {
    if (!this.elements.historyList) return;

    this.elements.historyList.innerHTML = "";

    if (history.length === 0) {
      const emptyMessage = document.createElement("div");
      emptyMessage.className = "aiGeminiTranslator_history-empty";
      emptyMessage.textContent = chrome.i18n.getMessage("HISTORY_EMPTY_MESSAGE");
      this.elements.historyList.appendChild(emptyMessage);
      this.updateSelectionButtons();
      return;
    }

    history.forEach((item) => {
      const historyCard = this.createHistoryCard(item);
      this.elements.historyList.appendChild(historyCard);
    });

    this.updateSelectionButtons();
  }

  createHistoryCard(item) {
    const historyCard = document.createElement("div");
    historyCard.className = "aiGeminiTranslator_history-card";
    historyCard.dataset.itemId = item.id;

    // Add selection checkbox
    const checkbox = document.createElement("div");
    checkbox.className = "aiGeminiTranslator_history-checkbox";
    checkbox.addEventListener("click", (e) => {
      e.stopPropagation();
      this.toggleHistoryItemSelection(item.id);
    });

    // Content container
    const contentDiv = document.createElement("div");
    contentDiv.className = "aiGeminiTranslator_history-content";

    const originalDiv = document.createElement("div");
    originalDiv.className = "aiGeminiTranslator_history-original";
    originalDiv.textContent = item.originalText.length > 25
      ? item.originalText.substring(0, 25) + "..."
      : item.originalText;
    originalDiv.title = item.originalText;

    const translatedDiv = document.createElement("div");
    translatedDiv.className = "aiGeminiTranslator_history-translated";
    translatedDiv.textContent = item.translatedText.length > 25
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
    const sourceLangLabel = sourceLanguage === "auto" ? "Auto" : getLanguageLabel(sourceLanguage);
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
    contentDiv.addEventListener("click", () => this.restoreFromHistory(item));

    // Apply selection state
    if (this.selectedHistoryItems.has(item.id)) {
      historyCard.classList.add("selected");
      checkbox.classList.add("checked");
    }

    return historyCard;
  }

  restoreFromHistory(historyItem) {
    this.elements.textToTranslateTextarea.value = historyItem.originalText;
    this.elements.translatedTextTextarea.value = historyItem.translatedText;
    this.elements.textTargetLanguageSelect.value = historyItem.targetLanguage;

    // Save restored session
    this.saveTranslationSession();
  }

  toggleHistoryItemSelection(itemId) {
    if (this.selectedHistoryItems.has(itemId)) {
      this.selectedHistoryItems.delete(itemId);
    } else {
      this.selectedHistoryItems.add(itemId);
    }

    // Update visual state
    const card = document.querySelector(`[data-item-id="${itemId}"]`);
    if (card) {
      const checkbox = card.querySelector(".aiGeminiTranslator_history-checkbox");
      card.classList.toggle("selected");
      checkbox.classList.toggle("checked");
    }

    this.updateSelectionButtons();
  }

  updateSelectionButtons() {
    const hasSelection = this.selectedHistoryItems.size > 0;
    const historyCards = this.elements.historyList.querySelectorAll(".aiGeminiTranslator_history-card[data-item-id]");
    const totalItems = historyCards.length;
    const hasItems = totalItems > 0;

    this.elements.deleteSelectedButton.disabled = !hasSelection;
    this.elements.selectAllButton.disabled = !hasItems;

    // Update select all button text
    if (hasItems) {
      const allSelected = this.selectedHistoryItems.size === totalItems && totalItems > 0;
      this.elements.selectAllButton.textContent = allSelected
        ? chrome.i18n.getMessage("HISTORY_DESELECT_ALL_BUTTON_TEXT")
        : chrome.i18n.getMessage("HISTORY_SELECT_ALL_BUTTON_TEXT");
    }
  }

  selectAllHistoryItems() {
    const historyCards = this.elements.historyList.querySelectorAll(".aiGeminiTranslator_history-card[data-item-id]");
    const allSelected = this.selectedHistoryItems.size === historyCards.length && historyCards.length > 0;

    if (allSelected) {
      // Deselect all
      this.selectedHistoryItems.clear();
      historyCards.forEach((card) => {
        card.classList.remove("selected");
        const checkbox = card.querySelector(".aiGeminiTranslator_history-checkbox");
        if (checkbox) checkbox.classList.remove("checked");
      });
    } else {
      // Select all
      historyCards.forEach((card) => {
        const itemId = card.dataset.itemId;
        if (itemId) {
          this.selectedHistoryItems.add(itemId);
          card.classList.add("selected");
          const checkbox = card.querySelector(".aiGeminiTranslator_history-checkbox");
          if (checkbox) checkbox.classList.add("checked");
        }
      });
    }

    this.updateSelectionButtons();
  }

  async deleteSelectedHistoryItems() {
    if (this.selectedHistoryItems.size === 0) return;

    const storageData = await safeStorageGet(["translationHistory"]);
    const translationHistory = storageData.translationHistory || [];

    // Filter out selected items
    const updatedHistory = translationHistory.filter(
      (item) => !this.selectedHistoryItems.has(item.id)
    );

    await safeStorageSet({ translationHistory: updatedHistory });

    // Clear selection
    this.selectedHistoryItems.clear();

    // Re-render list
    this.renderHistoryList(updatedHistory);
  }

  saveTranslationSession() {
    // This method should be implemented in the main popup file
    // or passed as a callback to avoid circular dependencies
    console.log('saveTranslationSession called from HistoryManager');
  }
}