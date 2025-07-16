import { state, updateState } from '../utils/state.js';
import { elementReferences } from '../utils/cleanup.js';

export function showDialogBox(translatedText) {
  if (state.dialogBox) {
    removeDialogBox();
  }

  state.dialogBox = document.createElement("div");
  state.dialogBox.className = "aiGeminiTranslator_translation-dialog";

  // Position dialog - use icon position if available, otherwise center on screen
  if (state.icon && state.icon.style.left && state.icon.style.top) {
    const iconLeft = parseInt(state.icon.style.left);
    const iconTop = parseInt(state.icon.style.top);
    state.dialogBox.style.left = `${iconLeft}px`;
    state.dialogBox.style.top = `${iconTop}px`;
  } else {
    // Center dialog on screen for screenshot OCR results
    state.dialogBox.style.position = "fixed";
    state.dialogBox.style.left = "50%";
    state.dialogBox.style.top = "50%";
    state.dialogBox.style.transform = "translate(-50%, -50%)";
    state.dialogBox.style.zIndex = "999999";
  }

  // Store reference in WeakMap
  elementReferences.set(state.dialogBox, {
    type: "translation-dialog",
    created: Date.now(),
  });

  // Create content container
  const content = document.createElement("div");
  content.className = "aiGeminiTranslator_translation-content";
  content.textContent = translatedText;

  const isError = translatedText.includes(
    chrome.i18n.getMessage("TRANSLATION_FAILED_MESSAGE")
  );

  if (isError) {
    state.dialogBox.classList.add("error");
    content.classList.add("error");
  }

  state.dialogBox.appendChild(content);
  document.body.appendChild(state.dialogBox);

  // Adjust position if dialog would go outside viewport
  const dialogRect = state.dialogBox.getBoundingClientRect();
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

  if (state.icon) {
    const iconLeft = parseInt(state.icon.style.left);
    const iconTop = parseInt(state.icon.style.top);
    
    if (dialogRect.right > viewportWidth) {
      state.dialogBox.style.left = `${iconLeft - dialogRect.width}px`;
    }
    if (dialogRect.bottom > viewportHeight) {
      state.dialogBox.style.top = `${iconTop - dialogRect.height}px`;
    }
  }
}

export function removeDialogBox() {
  if (state.dialogBox) {
    // Proper cleanup before removal
    elementReferences.delete(state.dialogBox);
    state.dialogBox.remove();
    updateState({ dialogBox: null });
  }

  if (state.icon) {
    // Import translateSelectedText function dynamically to avoid circular dependency
    import('./translator.js').then(({ translateSelectedText }) => {
      state.icon.removeEventListener("click", translateSelectedText);
    });
    elementReferences.delete(state.icon);
    state.icon.remove();
    updateState({ icon: null });
  }

  updateState({ 
    selectedText: null, 
    targetLanguage: null 
  });
}