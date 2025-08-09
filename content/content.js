const elementReferences = new WeakMap();
let cleanupFunctions = [];

let icon;
let dialogBox;
let selectedText;
let targetLanguage;
let isScriptActive = true;
let isTranslationInProgress = false;
let imageOverlay = null;
let isImageSelectionMode = false;
let screenshotSelector = null;
let isScreenshotMode = false;
let selectionStart = null;
let selectionEnd = null;

// Content script loaded

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "startOCRMode") {
    console.log("Received startOCRMode message from popup");
    startScreenshotMode();
    sendResponse({ success: true });
  }
  return true;
});

// Cleanup function
function cleanup() {
  if (icon) {
    icon.removeEventListener("click", translateSelectedText);
    if (icon.parentNode) {
      icon.parentNode.removeChild(icon);
    }
    icon = null;
  }

  if (dialogBox) {
    if (dialogBox.parentNode) {
      dialogBox.parentNode.removeChild(dialogBox);
    }
    dialogBox = null;
  }

  if (imageOverlay) {
    if (imageOverlay.parentNode) {
      imageOverlay.parentNode.removeChild(imageOverlay);
    }
    imageOverlay = null;
  }

  if (screenshotSelector) {
    if (screenshotSelector.parentNode) {
      screenshotSelector.parentNode.removeChild(screenshotSelector);
    }
    screenshotSelector = null;
  }

  selectedText = null;
  targetLanguage = null;
  isImageSelectionMode = false;
  isScreenshotMode = false;
  selectionStart = null;
  selectionEnd = null;

  // Cleanup all registered functions
  cleanupFunctions.forEach((fn) => fn());
  cleanupFunctions = [];
}

// Improved event handler functions
const handleMouseUp = async (event) => {
  if (!isScriptActive) return;

  if (isScreenshotMode && selectionStart) {
    event.preventDefault();
    selectionEnd = {
      x: event.clientX + window.scrollX,
      y: event.clientY + window.scrollY,
    };
    await captureScreenshotArea();
    return;
  }

  setTimeout(async () => {
    // Sprawdź czy zaznaczenie jest w okienku dialogowym
    const selection = window.getSelection();
    
    if (dialogBox && dialogBox.contains(selection.anchorNode)) {
      return;
    }

    // Reszta istniejącej logiki
    const activeElement = document.activeElement;
    const isInput =
      activeElement.tagName === "INPUT" || activeElement.tagName === "TEXTAREA";

    if (isInput) {
      hideIcon();
      return;
    }

    selectedText = selection.toString().trim();
    
    if (selectedText) {
      if (selection && selection.rangeCount > 0) {
        try {
          // Check if chrome.storage is available
          if (chrome && chrome.storage && chrome.storage.local) {
            const { textTargetLanguage } = await chrome.storage.local.get([
              "textTargetLanguage",
            ]);
            targetLanguage = textTargetLanguage || "English";
          } else {
            // Fallback if storage is not available
            targetLanguage = "English";
          }
          showTranslationIcon(event);
        } catch (error) {
          console.warn('Failed to get language setting, using default:', error);
          targetLanguage = "English";
          showTranslationIcon(event);
        }
      }
    } else {
      hideIcon();
    }
  }, 10);
};

const handleMouseDown = (event) => {
  if (isScreenshotMode) {
    event.preventDefault();
    selectionStart = {
      x: event.clientX + window.scrollX,
      y: event.clientY + window.scrollY,
    };
    return;
  }

  if (icon && !icon.contains(event.target)) {
    hideIcon();
  }
  if (dialogBox && !dialogBox.contains(event.target)) {
    removeDialogBox();
    return;
  }
};

const handleKeyEvents = (e) => {
  if (e.key === "Escape") {
    if (dialogBox) {
      removeDialogBox();
      return;
    }
    if (isImageSelectionMode) {
      exitImageSelectionMode();
      return;
    }
    if (isScreenshotMode) {
      exitScreenshotMode();
      return;
    }
  }

  if (e.ctrlKey && e.key === "t" && selectedText) {
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
  if (isScreenshotMode && selectionStart) {
    updateSelectionRectangle(event);
  }
};

// Register event listeners with cleanup
document.addEventListener("mouseup", handleMouseUp);
document.addEventListener("mousedown", handleMouseDown);
document.addEventListener("mousemove", handleMouseMove);
document.addEventListener("keydown", handleKeyEvents);
document.addEventListener("contextmenu", handleContextMenu);

// Register cleanup functions
cleanupFunctions.push(() => {
  document.removeEventListener("mouseup", handleMouseUp);
  document.removeEventListener("mousedown", handleMouseDown);
  document.removeEventListener("mousemove", handleMouseMove);
  document.removeEventListener("keydown", handleKeyEvents);
  document.removeEventListener("contextmenu", handleContextMenu);
});

// Page unload cleanup
window.addEventListener("beforeunload", cleanup);
cleanupFunctions.push(() => {
  window.removeEventListener("beforeunload", cleanup);
});

function showTranslationIcon(event) {
  if (!icon) {
    icon = document.createElement("div");
    icon.className = "aiGeminiTranslator_translation-selected-text-icon";
    icon.innerHTML = `<img class="aiGeminiTranslator_translation-selected-text-icon-image" src="${chrome.runtime.getURL(
      "icons/icon48.png"
    )}" alt="Translate">`;
    icon.addEventListener("click", translateSelectedText);
    document.body.appendChild(icon);

    // Store reference in WeakMap for proper memory management
    elementReferences.set(icon, {
      type: "translation-icon",
      created: Date.now(),
    });
  }

  const iconRect = icon.getBoundingClientRect();
  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = document.documentElement.clientHeight;

  // Nowe obliczenia pozycji uwzględniające scroll
  let posX = event.clientX + window.scrollX;
  let posY = event.clientY + window.scrollY;

  // Dopasowanie pozycji do widocznego obszaru
  posX = Math.min(posX + 10, viewportWidth + window.scrollX - iconRect.width);
  posY = Math.min(
    posY - iconRect.height / 2,
    viewportHeight + window.scrollY - iconRect.height
  );

  icon.style.left = `${posX}px`;
  icon.style.top = `${posY}px`;
  icon.style.display = "block";
  icon.title = chrome.i18n.getMessage("translate_button") || "Translate";
}

function hideIcon() {
  if (icon) {
    icon.style.display = "none";
    // Clear any pending references
    selectedText = null;
  }
}

async function translateSelectedText() {
  if (!selectedText || isTranslationInProgress) return;

  isTranslationInProgress = true;
  const originalIcon = icon.innerHTML;
  icon.innerHTML =
    '<div class="aiGeminiTranslator_loadingGeminiTranslation"></div>';
  icon.style.cursor = "wait";

  // Add timeout to prevent hanging
  const timeoutId = setTimeout(() => {
    isTranslationInProgress = false;
    if (icon) {
      icon.innerHTML = originalIcon;
      icon.style.cursor = "pointer";
    }
    showDialogBox(
      chrome.i18n.getMessage("TRANSLATION_FAILED_MESSAGE") + ": Timeout"
    );
  }, 30000); // 30 second timeout

  chrome.runtime.sendMessage(
    {
      action: "translateSelectedText",
      text: selectedText,
      targetLanguage: targetLanguage,
    },
    (response) => {
      clearTimeout(timeoutId); // Clear the timeout
      isTranslationInProgress = false;

      if (chrome.runtime.lastError) {
        if (icon) {
          icon.innerHTML = originalIcon;
          icon.style.cursor = "pointer";
        }
        showDialogBox(chrome.i18n.getMessage("TRANSLATION_FAILED_MESSAGE"));
        return;
      }

      if (response?.translatedText) {
        hideIcon();
        showDialogBox(response.translatedText);
      } else {
        if (icon) {
          icon.innerHTML = originalIcon;
          icon.style.cursor = "pointer";
        }
        showDialogBox(chrome.i18n.getMessage("TRANSLATION_FAILED_MESSAGE"));
      }
    }
  );
}

function showDialogBox(translatedText) {
  if (dialogBox) {
    removeDialogBox();
  }

  dialogBox = document.createElement("div");
  dialogBox.className = "aiGeminiTranslator_translation-dialog";

  // Position dialog - use icon position if available, otherwise center on screen
  if (icon && icon.style.left && icon.style.top) {
    const iconLeft = parseInt(icon.style.left);
    const iconTop = parseInt(icon.style.top);
    dialogBox.style.left = `${iconLeft}px`;
    dialogBox.style.top = `${iconTop}px`;
  } else {
    // Center dialog on screen for screenshot OCR results
    dialogBox.style.position = "fixed";
    dialogBox.style.left = "50%";
    dialogBox.style.top = "50%";
    dialogBox.style.transform = "translate(-50%, -50%)";
    dialogBox.style.zIndex = "999999";
  }

  // Store reference in WeakMap
  elementReferences.set(dialogBox, {
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
    dialogBox.classList.add("error");
    content.classList.add("error");
  }

  dialogBox.appendChild(content);

  document.body.appendChild(dialogBox);

  // Adjust position if dialog would go outside viewport
  const dialogRect = dialogBox.getBoundingClientRect();
  const viewportWidth =
    window.innerWidth || document.documentElement.clientWidth;
  const viewportHeight =
    window.innerHeight || document.documentElement.clientHeight;

  if (dialogRect.right > viewportWidth) {
    dialogBox.style.left = `${iconLeft - dialogRect.width}px`;
  }
  if (dialogRect.bottom > viewportHeight) {
    dialogBox.style.top = `${iconTop - dialogRect.height}px`;
  }
}

function removeDialogBox() {
  if (dialogBox) {
    // Proper cleanup before removal
    elementReferences.delete(dialogBox);
    dialogBox.remove();
    dialogBox = null;
  }

  if (icon) {
    icon.removeEventListener("click", translateSelectedText);
    elementReferences.delete(icon);
    icon.remove();
    icon = null;
  }

  selectedText = null;
  targetLanguage = null;
}

const createDOMElement = (type, classes, attributes) => {
  const el = document.createElement(type);
  if (classes) el.className = classes;
  if (attributes) {
    Object.entries(attributes).forEach(([key, value]) => {
      el.setAttribute(key, value);
    });
  }
  return el;
};

// Screenshot translation functions
function startScreenshotMode() {
  console.log("Starting screenshot mode...");
  
  if (isScreenshotMode) {
    console.log("Screenshot mode already active");
    return;
  }

  isScreenshotMode = true;
  document.body.style.cursor = "crosshair";

  // Create overlay
  screenshotSelector = document.createElement("div");
  screenshotSelector.className = "aiGeminiTranslator_screenshot-overlay";
  
  // Use inline styles as backup in case CSS doesn't load
  screenshotSelector.style.cssText = `
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

  // Create selection rectangle
  const selectionRect = document.createElement("div");
  selectionRect.className = "aiGeminiTranslator_selection-rect";
  selectionRect.style.display = "none";

  screenshotSelector.appendChild(selectionRect);
  document.body.appendChild(screenshotSelector);
  
  console.log("Screenshot overlay created and added to body");

  // Store reference in WeakMap
  elementReferences.set(screenshotSelector, {
    type: "screenshot-selector",
    created: Date.now(),
  });

  // Show instructions
  showScreenshotInstructions();
}

function updateSelectionRectangle(event) {
  if (!screenshotSelector || !selectionStart) return;

  const rect = screenshotSelector.querySelector(
    ".aiGeminiTranslator_selection-rect"
  );
  if (!rect) return;

  const currentX = event.clientX;
  const currentY = event.clientY;

  const left = Math.min(selectionStart.x - window.scrollX, currentX);
  const top = Math.min(selectionStart.y - window.scrollY, currentY);
  const width = Math.abs(currentX - (selectionStart.x - window.scrollX));
  const height = Math.abs(currentY - (selectionStart.y - window.scrollY));

  // Apply styles directly to ensure visibility
  rect.style.display = "block";
  rect.style.left = `${left}px`;
  rect.style.top = `${top}px`;
  rect.style.width = `${width}px`;
  rect.style.height = `${height}px`;
  
  console.log(`Selection rectangle: ${left}, ${top}, ${width}x${height}`);
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

  screenshotSelector.appendChild(instructions);
  console.log("Screenshot instructions shown");

  // Auto-hide instructions after 5 seconds
  setTimeout(() => {
    if (instructions && instructions.parentNode) {
      instructions.remove();
    }
  }, 5000);
}

async function captureScreenshotArea() {
  console.log("Capturing screenshot area...");

  if (!selectionStart || !selectionEnd) {
    console.log("No selection start or end points");
    return;
  }

  const left = Math.min(selectionStart.x, selectionEnd.x);
  const top = Math.min(selectionStart.y, selectionEnd.y);
  const width = Math.abs(selectionEnd.x - selectionStart.x);
  const height = Math.abs(selectionEnd.y - selectionStart.y);

  console.log(`Screenshot area: ${left}, ${top}, ${width}x${height}`);

  if (width < 10 || height < 10) {
    console.log("Area too small, exiting screenshot mode");
    exitScreenshotMode();
    return;
  }

  // Use a single dialog for loading and results
  const ocrDialog = showOcrDialog();

  try {
    let targetLang = "English";
    try {
      const { textTargetLanguage } = await chrome.storage.local.get([
        "textTargetLanguage",
      ]);
      targetLang = textTargetLanguage || "English";
    } catch (error) {
      console.warn(
        "Failed to get language setting for screenshot, using default:",
        error
      );
    }

    console.log(`Target language: ${targetLang}`);
    console.log("Sending screenshot request to background script...");

    chrome.runtime.sendMessage(
      {
        action: "captureAndTranslateScreenshot",
        area: { left, top, width, height },
        targetLanguage: targetLang,
      },
      (response) => {
        console.log("Received response from background script:", response);
        // Don't exit screenshot mode here, as the dialog is now the main UI

        const contentEl = ocrDialog.querySelector(".aiGeminiTranslator_ocr-content");
        if (!contentEl) return;

        if (chrome.runtime.lastError) {
          console.error("Runtime error:", chrome.runtime.lastError);
          contentEl.textContent =
            chrome.i18n.getMessage("TRANSLATION_FAILED_MESSAGE") ||
            "Translation failed";
          ocrDialog.classList.add("error");
          return;
        }

        if (response?.translatedText) {
          contentEl.textContent = response.translatedText;
          ocrDialog.classList.remove("loading");
        } else {
          contentEl.textContent =
            (chrome.i18n.getMessage("TRANSLATION_FAILED_MESSAGE") ||
              "Translation failed") +
            (response?.error ? ": " + response.error : "");
          ocrDialog.classList.add("error");
        }
      }
    );
  } catch (error) {
    console.error("Screenshot capture error:", error);
    const contentEl = ocrDialog.querySelector(".aiGeminiTranslator_ocr-content");
    if(contentEl) {
        contentEl.textContent =
            chrome.i18n.getMessage("TRANSLATION_FAILED_MESSAGE") ||
            "Translation failed";
        ocrDialog.classList.add("error");
    }
  } finally {
      // Clean up the selection overlay, but not the dialog
      if (screenshotSelector) {
        screenshotSelector.remove();
        screenshotSelector = null;
      }
      isScreenshotMode = false;
      document.body.style.cursor = "";
      selectionStart = null;
      selectionEnd = null;
  }
}

function showOcrDialog() {
  // If a dialog already exists, remove it
  if (dialogBox) {
    removeDialogBox();
  }

  dialogBox = document.createElement("div");
  dialogBox.className = "aiGeminiTranslator_translation-dialog loading"; // Start with loading class

  // Center dialog on screen
  dialogBox.style.position = "fixed";
  dialogBox.style.left = "50%";
  dialogBox.style.top = "50%";
  dialogBox.style.transform = "translate(-50%, -50%)";
  dialogBox.style.zIndex = "999999";

  dialogBox.innerHTML = `
    <div class="aiGeminiTranslator_dialog-header">
        <span>OCR Translation</span>
        <button class="aiGeminiTranslator_dialog-close">×</button>
    </div>
    <div class="aiGeminiTranslator_ocr-content">
        <div class="aiGeminiTranslator_loadingGeminiTranslation"></div>
        <span>Translating...</span>
    </div>
  `;

  document.body.appendChild(dialogBox);

  // Add close functionality
  const closeButton = dialogBox.querySelector(".aiGeminiTranslator_dialog-close");
  closeButton.addEventListener("click", removeDialogBox);

  return dialogBox;
}

function exitScreenshotMode() {
  isScreenshotMode = false;
  document.body.style.cursor = "";
  selectionStart = null;
  selectionEnd = null;

  if (screenshotSelector) {
    elementReferences.delete(screenshotSelector);
    screenshotSelector.remove();
    screenshotSelector = null;
  }
}

function exitImageSelectionMode() {
  // Placeholder for image selection mode exit
  isImageSelectionMode = false;
}

function showImageTranslationOption(img, event) {
  // Placeholder for image translation option
  console.log("Image translation not implemented yet");
}
