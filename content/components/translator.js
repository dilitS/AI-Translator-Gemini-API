import { state, updateState } from '../utils/state.js';
import { showDialogBox } from './dialogBox.js';
import { hideIcon } from './translationIcon.js';

export async function translateSelectedText() {
  if (!state.selectedText || state.isTranslationInProgress) return;

  updateState({ isTranslationInProgress: true });
  const originalIcon = state.icon.innerHTML;
  state.icon.innerHTML = '<div class="aiGeminiTranslator_loadingGeminiTranslation"></div>';
  state.icon.style.cursor = "wait";

  // Add timeout to prevent hanging
  const timeoutId = setTimeout(() => {
    updateState({ isTranslationInProgress: false });
    if (state.icon) {
      state.icon.innerHTML = originalIcon;
      state.icon.style.cursor = "pointer";
    }
    showDialogBox(
      chrome.i18n.getMessage("TRANSLATION_FAILED_MESSAGE") + ": Timeout"
    );
  }, 30000); // 30 second timeout

  chrome.runtime.sendMessage(
    {
      action: "translateSelectedText",
      text: state.selectedText,
      targetLanguage: state.targetLanguage,
    },
    (response) => {
      clearTimeout(timeoutId); // Clear the timeout
      updateState({ isTranslationInProgress: false });

      if (chrome.runtime.lastError) {
        if (state.icon) {
          state.icon.innerHTML = originalIcon;
          state.icon.style.cursor = "pointer";
        }
        showDialogBox(chrome.i18n.getMessage("TRANSLATION_FAILED_MESSAGE"));
        return;
      }

      if (response?.translatedText) {
        hideIcon();
        showDialogBox(response.translatedText);
      } else {
        if (state.icon) {
          state.icon.innerHTML = originalIcon;
          state.icon.style.cursor = "pointer";
        }
        showDialogBox(chrome.i18n.getMessage("TRANSLATION_FAILED_MESSAGE"));
      }
    }
  );
}