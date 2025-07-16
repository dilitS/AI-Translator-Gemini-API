import { modeConfigs } from './constants.js';

// UI utility functions
export function updateModeInterface(mode, elements) {
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

export function getLocalizedModeTitle(mode) {
  const config = modeConfigs[mode];
  return config ? chrome.i18n.getMessage(config.titleKey) : mode;
}

export function showCopyStatus(message, color) {
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

export function showStatus(element, message, type = "info") {
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