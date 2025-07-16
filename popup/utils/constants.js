// Constants and configuration for popup
export const textElements = {
  "aiGeminiTranslator_select-label": "TEXT_TO_TRANSLATE_LABEL",
  "aiGeminiTranslator_translate-text-button": "TRANSLATE_TEXT_BUTTON_TEXT",
  "aiGeminiTranslator_save-api-key-button": "SAVE_API_KEY_BUTTON_TEXT",
  "aiGeminiTranslator_text-to-translate": "TEXT_TO_TRANSLATE_PLACEHOLDER",
  "aiGeminiTranslator_translated-text": "TRANSLATED_TEXT_PLACEHOLDER",
  "aiGeminiTranslator_text-translation-status": "TEXT_TRANSLATION_STATUS_MESSAGE",
  "aiGeminiTranslator_api-key-input": "API_KEY_PLACEHOLDER",
  "aiGeminiTranslator_translation-card-header-title": "TRANSLATION_CARD_HEADER_TITLE",
  "aiGeminiTranslator_settings-card-header-title": "SETTINGS_CARD_HEADER_TITLE",
  "aiGeminiTranslator_selected-text-language-label": "SELECTED_TEXT_LANGUAGE_LABEL",
  "aiGeminiTranslator_api-key-label": "API_KEY_LABEL",
  "aiGeminiTranslator_copy-icon": "COPY_ICON_TOOLTIP",
  "aiGeminiTranslator_history-card-header-title": "HISTORY_CARD_HEADER_TITLE",
  "aiGeminiTranslator_select-all-button": "HISTORY_SELECT_ALL_BUTTON_TEXT",
  "aiGeminiTranslator_delete-selected-button": "HISTORY_DELETE_SELECTED_BUTTON_TEXT",
};

export const modeConfigs = {
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

export const systemLanguage = chrome.i18n.getUILanguage().split("-")[0];