import { state, updateState } from './state.js';
import { showTranslationIcon, hideIcon } from '../components/translationIcon.js';
import { removeDialogBox } from '../components/dialogBox.js';
import { startScreenshotMode, updateSelectionRectangle, captureScreenshotArea, exitScreenshotMode } from '../components/screenshotMode.js';

// Improved event handler functions
export const handleMouseUp = async (event) => {
  if (!state.isScriptActive) return;

  if (state.isScreenshotMode && state.selectionStart) {
    event.preventDefault();
    updateState({
      selectionEnd: {
        x: event.clientX + window.scrollX,
        y: event.clientY + window.scrollY,
      }
    });
    await captureScreenshotArea();
    return;
  }

  setTimeout(async () => {
    // Check if selection is in dialog box
    const selection = window.getSelection();
    
    if (state.dialogBox && state.dialogBox.contains(selection.anchorNode)) {
      return;
    }

    // Rest of existing logic
    const activeElement = document.activeElement;
    const isInput = activeElement.tagName === "INPUT" || activeElement.tagName === "TEXTAREA";

    if (isInput) {
      hideIcon();
      return;
    }

    const selectedText = selection.toString().trim();
    
    if (selectedText) {
      if (selection && selection.rangeCount > 0) {
        try {
          // Check if chrome.storage is available
          if (chrome && chrome.storage && chrome.storage.local) {
            const { selectedTextLanguage } = await chrome.storage.local.get(["selectedTextLanguage"]);
            updateState({ 
              selectedText,
              targetLanguage: selectedTextLanguage || "English"
            });
          } else {
            // Fallback if storage is not available
            updateState({ 
              selectedText,
              targetLanguage: "English"
            });
          }
          showTranslationIcon(event);
        } catch (error) {
          console.warn('Failed to get language setting, using default:', error);
          updateState({ 
            selectedText,
            targetLanguage: "English"
          });
          showTranslationIcon(event);
        }
      }
    } else {
      hideIcon();
    }
  }, 10);
};

export const handleMouseDown = (event) => {
  if (state.isScreenshotMode) {
    event.preventDefault();
    updateState({
      selectionStart: {
        x: event.clientX + window.scrollX,
        y: event.clientY + window.scrollY,
      }
    });
    return;
  }

  if (state.icon && !state.icon.contains(event.target)) {
    hideIcon();
  }
  if (state.dialogBox && !state.dialogBox.contains(event.target)) {
    removeDialogBox();
    return;
  }
};

export const handleKeyEvents = (e) => {
  if (e.key === "Escape") {
    if (state.dialogBox) {
      removeDialogBox();
      return;
    }
    if (state.isImageSelectionMode) {
      exitImageSelectionMode();
      return;
    }
    if (state.isScreenshotMode) {
      exitScreenshotMode();
      return;
    }
  }

  if (e.ctrlKey && e.key === "t" && state.selectedText) {
    e.preventDefault();
    import('../components/translator.js').then(({ translateSelectedText }) => {
      translateSelectedText();
    });
  }

  if (e.ctrlKey && e.shiftKey && e.key === "T") {
    e.preventDefault();
    startScreenshotMode();
  }
};

export const handleContextMenu = (e) => {
  if (e.target.tagName === "IMG") {
    e.preventDefault();
    showImageTranslationOption(e.target, e);
  }
};

export const handleMouseMove = (event) => {
  if (state.isScreenshotMode && state.selectionStart) {
    updateSelectionRectangle(event);
  }
};

// Placeholder functions
function exitImageSelectionMode() {
  updateState({ isImageSelectionMode: false });
}

function showImageTranslationOption(img, event) {
  console.log("Image translation not implemented yet");
}