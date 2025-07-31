(function() {
'use strict';

// From content/utils/state.js
let state = {
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

function updateState(updates) {
  Object.assign(state, updates);
}

function resetState() {
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

// From content/utils/cleanup.js
const elementReferences = new WeakMap();
let cleanupFunctions = [];

function addCleanupFunction(fn) {
  cleanupFunctions.push(fn);
}

function cleanup() {
  cleanupFunctions.forEach((fn) => fn());
  cleanupFunctions = [];
  elementReferences.clear();
}

window.addEventListener("beforeunload", cleanup);
addCleanupFunction(() => {
  window.removeEventListener("beforeunload", cleanup);
});

// From content/components/dialogBox.js
function showDialogBox(translatedText) {
  if (state.dialogBox) {
    removeDialogBox();
  }

  state.dialogBox = document.createElement("div");
  state.dialogBox.className = "aiGeminiTranslator_translation-dialog";

  if (state.icon && state.icon.style.left && state.icon.style.top) {
    const iconLeft = parseInt(state.icon.style.left);
    const iconTop = parseInt(state.icon.style.top);
    state.dialogBox.style.left = `${iconLeft}px`;
    state.dialogBox.style.top = `${iconTop}px`;
  } else {
    state.dialogBox.style.position = "fixed";
    state.dialogBox.style.left = "50%";
    state.dialogBox.style.top = "50%";
    state.dialogBox.style.transform = "translate(-50%, -50%)";
    state.dialogBox.style.zIndex = "999999";
  }

  elementReferences.set(state.dialogBox, {
    type: "translation-dialog",
    created: Date.now(),
  });

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

function removeDialogBox() {
  if (state.dialogBox) {
    elementReferences.delete(state.dialogBox);
    state.dialogBox.remove();
    updateState({ dialogBox: null });
  }

  if (state.icon) {
    elementReferences.delete(state.icon);
    state.icon.remove();
    updateState({ icon: null });
  }

  updateState({
    selectedText: null,
    targetLanguage: null
  });
}

// From content/components/translationIcon.js
function showTranslationIcon(event) {
  if (!state.icon) {
    state.icon = document.createElement("div");
    state.icon.className = "aiGeminiTranslator_translation-selected-text-icon";
    state.icon.innerHTML = `<img class="aiGeminiTranslator_translation-selected-text-icon-image" src="${chrome.runtime.getURL(
      "icons/icon48.png"
    )}" alt="Translate">`;

    state.icon.addEventListener("click", () => {
      const event = new CustomEvent('gemini-translator-translate');
      document.dispatchEvent(event);
    });

    document.body.appendChild(state.icon);

    elementReferences.set(state.icon, {
      type: "translation-icon",
      created: Date.now(),
    });
  }

  const iconRect = state.icon.getBoundingClientRect();
  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = document.documentElement.clientHeight;

  let posX = event.clientX + window.scrollX;
  let posY = event.clientY + window.scrollY;

  posX = Math.min(posX + 10, viewportWidth + window.scrollX - iconRect.width);
  posY = Math.min(
    posY - iconRect.height / 2,
    viewportHeight + window.scrollY - iconRect.height
  );

  state.icon.style.left = `${posX}px`;
  state.icon.style.top = `${posY}px`;
  state.icon.style.display = "block";
  state.icon.title = chrome.i18n.getMessage("translate_button") || "Translate";
}

function hideIcon() {
  if (state.icon) {
    state.icon.style.display = "none";
    updateState({ selectedText: null });
  }
}

// From content/components/translator.js
async function translateSelectedText() {
  if (!state.selectedText || state.isTranslationInProgress) return;

  updateState({ isTranslationInProgress: true });
  const originalIcon = state.icon.innerHTML;
  state.icon.innerHTML = '<div class="aiGeminiTranslator_loadingGeminiTranslation"></div>';
  state.icon.style.cursor = "wait";

  const timeoutId = setTimeout(() => {
    updateState({ isTranslationInProgress: false });
    if (state.icon) {
      state.icon.innerHTML = originalIcon;
      state.icon.style.cursor = "pointer";
    }
    showDialogBox(
      chrome.i18n.getMessage("TRANSLATION_FAILED_MESSAGE") + ": Timeout"
    );
  }, 30000);

  chrome.runtime.sendMessage(
    {
      action: "translateSelectedText",
      text: state.selectedText,
      targetLanguage: state.targetLanguage,
    },
    (response) => {
      clearTimeout(timeoutId);
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

// From content/components/screenshotMode.js
function startScreenshotMode() {
  if (state.isScreenshotMode) {
    return;
  }

  updateState({ isScreenshotMode: true });
  document.body.style.cursor = "crosshair";

  state.screenshotSelector = document.createElement("div");
  state.screenshotSelector.className = "aiGeminiTranslator_screenshot-overlay";

  state.screenshotSelector.style.cssText = `
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    background: rgba(0, 0, 0, 0.4) !important;
    z-index: 999999 !important;
    cursor: crosshair !important;
    pointer-events: auto !important;
    display: block !important;
    visibility: visible !important;
  `;

  const selectionRect = document.createElement("div");
  selectionRect.className = "aiGeminiTranslator_selection-rect";
  selectionRect.style.cssText = `
    position: absolute !important;
    border: 3px dashed #4CAF50 !important;
    background: rgba(76, 175, 80, 0.2) !important;
    display: none !important;
    pointer-events: none !important;
    box-sizing: border-box !important;
  `;

  state.screenshotSelector.appendChild(selectionRect);
  document.body.appendChild(state.screenshotSelector);

  elementReferences.set(state.screenshotSelector, {
    type: "screenshot-selector",
    created: Date.now(),
  });

  showScreenshotInstructions();
}

function updateSelectionRectangle(event) {
  if (!state.screenshotSelector || !state.selectionStart) return;

  const rect = state.screenshotSelector.querySelector(".aiGeminiTranslator_selection-rect");
  if (!rect) return;

  const currentX = event.clientX;
  const currentY = event.clientY;

  const left = Math.min(state.selectionStart.x - window.scrollX, currentX);
  const top = Math.min(state.selectionStart.y - window.scrollY, currentY);
  const width = Math.abs(currentX - (state.selectionStart.x - window.scrollX));
  const height = Math.abs(currentY - (state.selectionStart.y - window.scrollY));

  rect.style.position = "absolute";
  rect.style.border = "3px dashed #4CAF50";
  rect.style.background = "rgba(76, 175, 80, 0.2)";
  rect.style.display = "block";
  rect.style.pointerEvents = "none";
  rect.style.boxSizing = "border-box";
  rect.style.left = `${left}px`;
  rect.style.top = `${top}px`;
  rect.style.width = `${width}px`;
  rect.style.height = `${height}px`;
}

function showScreenshotInstructions() {
  const instructions = document.createElement("div");
  instructions.className = "aiGeminiTranslator_screenshot-instructions";
  instructions.style.cssText = `
    position: fixed !important;
    top: 20px !important;
    left: 50% !important;
    transform: translateX(-50%) !important;
    background: #333 !important;
    color: white !important;
    padding: 15px 25px !important;
    border-radius: 8px !important;
    z-index: 999999 !important;
    font-family: Arial, sans-serif !important;
    font-size: 16px !important;
    font-weight: bold !important;
    box-shadow: 0 4px 20px rgba(0,0,0,0.5) !important;
    border: 2px solid #4CAF50 !important;
    text-align: center !important;
  `;
  instructions.innerHTML = `
    📸 Tryb OCR aktywny<br>
    <small style="font-size: 12px; font-weight: normal;">
      Przeciągnij myszką aby zaznaczyć obszar • ESC aby anulować
    </small>
  `;

  state.screenshotSelector.appendChild(instructions);

  setTimeout(() => {
    if (instructions && instructions.parentNode) {
      instructions.remove();
    }
  }, 5000);
}

async function captureScreenshotArea() {
  if (!state.selectionStart || !state.selectionEnd) {
    return;
  }

  const left = Math.min(state.selectionStart.x, state.selectionEnd.x);
  const top = Math.min(state.selectionStart.y, state.selectionEnd.y);
  const width = Math.abs(state.selectionEnd.x - state.selectionStart.x);
  const height = Math.abs(state.selectionEnd.y - state.selectionStart.y);

  if (width < 10 || height < 10) {
    exitScreenshotMode();
    return;
  }

  showLoadingOverlay();

  let targetLang = "English";
  try {
    if (chrome && chrome.storage && chrome.storage.local) {
      const { selectedTextLanguage } = await chrome.storage.local.get(["selectedTextLanguage"]);
      targetLang = selectedTextLanguage || "English";
    }
  } catch (error) {
    console.warn('Failed to get language setting for screenshot, using default:', error);
  }

  chrome.runtime.sendMessage(
    {
      action: "captureAndTranslateScreenshot",
      area: { left, top, width, height },
      targetLanguage: targetLang,
    },
    (response) => {
      exitScreenshotMode();

      if (chrome.runtime.lastError) {
        showDialogBox(chrome.i18n.getMessage("TRANSLATION_FAILED_MESSAGE") || "Translation failed");
        return;
      }

      if (response?.translatedText) {
        showDialogBox(response.translatedText);
      } else {
        showDialogBox(
          (chrome.i18n.getMessage("TRANSLATION_FAILED_MESSAGE") || "Translation failed") +
            (response?.error ? ": " + response.error : "")
        );
      }
    }
  );
}

function showLoadingOverlay() {
  const loading = document.createElement("div");
  loading.className = "aiGeminiTranslator_screenshot-loading";
  loading.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: #333;
    color: white;
    padding: 20px;
    border-radius: 10px;
    z-index: 10002;
    font-family: Arial, sans-serif;
    text-align: center;
    box-shadow: 0 4px 20px rgba(0,0,0,0.5);
  `;
  loading.innerHTML = `
    <div style="margin-bottom: 10px;">📸 Capturing & Translating...</div>
    <div class="aiGeminiTranslator_loadingGeminiTranslation"></div>
  `;

  if (state.screenshotSelector) {
    state.screenshotSelector.appendChild(loading);
  }
}

function exitScreenshotMode() {
  updateState({ isScreenshotMode: false });
  document.body.style.cursor = "";
  updateState({
    selectionStart: null,
    selectionEnd: null
  });

  if (state.screenshotSelector) {
    elementReferences.delete(state.screenshotSelector);
    state.screenshotSelector.remove();
    updateState({ screenshotSelector: null });
  }
}

// From content/utils/eventHandlers.js
const handleMouseUp = async (event) => {
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
    const selection = window.getSelection();

    if (state.dialogBox && state.dialogBox.contains(selection.anchorNode)) {
      return;
    }

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
          if (chrome && chrome.storage && chrome.storage.local) {
            const { textTargetLanguage } = await chrome.storage.local.get(["textTargetLanguage"]);
            updateState({
              selectedText,
              targetLanguage: textTargetLanguage || "English"
            });
          } else {
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

const handleMouseDown = (event) => {
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

const handleKeyEvents = (e) => {
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
    translateSelectedText();
  }

  if (e.ctrlKey && e.shiftKey && e.key === "T") {
    e.preventDefault();
    startScreenshotMode();
  }
};

const handleContextMenu = (e) => {
  if (e.target.tagName === "IMG") {
    e.preventDefault();
    showImageTranslationOption(e.target, e);
  }
};

const handleMouseMove = (event) => {
  if (state.isScreenshotMode && state.selectionStart) {
    updateSelectionRectangle(event);
  }
};

function exitImageSelectionMode() {
  updateState({ isImageSelectionMode: false });
}

function showImageTranslationOption(img, event) {
  console.log("Image translation not implemented yet");
}

// From content/content_new.js
console.log('Content script loaded');

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "startOCRMode") {
    startScreenshotMode();
    sendResponse({ success: true });
  }
  return true;
});

document.addEventListener("mouseup", handleMouseUp);
document.addEventListener("mousedown", handleMouseDown);
document.addEventListener("mousemove", handleMouseMove);
document.addEventListener("keydown", handleKeyEvents);
document.addEventListener("contextmenu", handleContextMenu);
document.addEventListener('gemini-translator-translate', translateSelectedText);

addCleanupFunction(() => {
  document.removeEventListener("mouseup", handleMouseUp);
  document.removeEventListener("mousedown", handleMouseDown);
  document.removeEventListener("mousemove", handleMouseMove);
  document.removeEventListener("keydown", handleKeyEvents);
  document.removeEventListener("contextmenu", handleContextMenu);
  document.removeEventListener('gemini-translator-translate', translateSelectedText);
});

})();
