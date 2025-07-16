// Global state management for content script
export let state = {
  icon: null,
  dialogBox: null,
  selectedText: null,
  targetLanguage: null,
  isScriptActive: true,
  isTranslationInProgress: false,
  imageOverlay: null,
  isImageSelectionMode: false,
  screenshotSelector: null,
  isScreenshotMode: false,
  selectionStart: null,
  selectionEnd: null,
};

export function updateState(updates) {
  Object.assign(state, updates);
}

export function resetState() {
  state = {
    icon: null,
    dialogBox: null,
    selectedText: null,
    targetLanguage: null,
    isScriptActive: true,
    isTranslationInProgress: false,
    imageOverlay: null,
    isImageSelectionMode: false,
    screenshotSelector: null,
    isScreenshotMode: false,
    selectionStart: null,
    selectionEnd: null,
  };
}