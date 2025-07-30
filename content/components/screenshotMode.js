import { state, updateState } from '../utils/state.js';
import { elementReferences } from '../utils/cleanup.js';
import { showDialogBox } from './dialogBox.js';

export function startScreenshotMode() {
  console.log("Starting screenshot mode...");
  
  if (state.isScreenshotMode) {
    console.log("Screenshot mode already active");
    return;
  }

  updateState({ isScreenshotMode: true });
  document.body.style.cursor = "crosshair";

  // Create overlay
  state.screenshotSelector = document.createElement("div");
  state.screenshotSelector.className = "aiGeminiTranslator_screenshot-overlay";
  
  // Use inline styles as backup in case CSS doesn't load
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

  // Create selection rectangle
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
  
  console.log("Screenshot overlay created and added to body");

  // Store reference in WeakMap
  elementReferences.set(state.screenshotSelector, {
    type: "screenshot-selector",
    created: Date.now(),
  });

  // Show instructions
  showScreenshotInstructions();
}

export function updateSelectionRectangle(event) {
  if (!state.screenshotSelector || !state.selectionStart) return;

  const rect = state.screenshotSelector.querySelector(".aiGeminiTranslator_selection-rect");
  if (!rect) return;

  const currentX = event.clientX;
  const currentY = event.clientY;

  const left = Math.min(state.selectionStart.x - window.scrollX, currentX);
  const top = Math.min(state.selectionStart.y - window.scrollY, currentY);
  const width = Math.abs(currentX - (state.selectionStart.x - window.scrollX));
  const height = Math.abs(currentY - (state.selectionStart.y - window.scrollY));

  // Apply styles directly to ensure visibility
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

  state.screenshotSelector.appendChild(instructions);
  console.log("Screenshot instructions shown");

  // Auto-hide instructions after 5 seconds
  setTimeout(() => {
    if (instructions && instructions.parentNode) {
      instructions.remove();
    }
  }, 5000);
}

export async function captureScreenshotArea() {
  console.log("Capturing screenshot area...");
  
  if (!state.selectionStart || !state.selectionEnd) {
    console.log("[OCR] No selection start or end points");
    return;
  }

  const left = Math.min(state.selectionStart.x, state.selectionEnd.x);
  const top = Math.min(state.selectionStart.y, state.selectionEnd.y);
  const width = Math.abs(state.selectionEnd.x - state.selectionStart.x);
  const height = Math.abs(state.selectionEnd.y - state.selectionStart.y);

  console.log(`[OCR] Screenshot area: ${left}, ${top}, ${width}x${height}`);

  // Minimum size check
  if (width < 10 || height < 10) {
    console.log("Area too small, exiting screenshot mode");
    exitScreenshotMode();
    return;
  }

  try {
    // Show loading state
    showLoadingOverlay();

    // Get target language
    let targetLang = "English";
    try {
      if (chrome && chrome.storage && chrome.storage.local) {
        const { selectedTextLanguage } = await chrome.storage.local.get(["selectedTextLanguage"]);
        targetLang = selectedTextLanguage || "English";
      }
    } catch (error) {
      console.warn('Failed to get language setting for screenshot, using default:', error);
    }
    
    console.log(`Target language: ${targetLang}`);

    // Send screenshot request to background script
    console.log("[OCR] Sending screenshot request to background script...");
    chrome.runtime.sendMessage(
      {
        action: "captureAndTranslateScreenshot",
        area: { left, top, width, height },
        targetLanguage: targetLang,
      },
      (response) => {
        console.log("[OCR] Received response from background script:", response);
        exitScreenshotMode();

        if (chrome.runtime.lastError) {
          console.error("Runtime error:", chrome.runtime.lastError);
          showDialogBox(chrome.i18n.getMessage("TRANSLATION_FAILED_MESSAGE") || "Translation failed");
          return;
        }

        if (response?.translatedText) {
          console.log("Translation successful:", response.translatedText);
          showDialogBox(response.translatedText);
        } else {
          console.log("Translation failed:", response);
          showDialogBox(
            (chrome.i18n.getMessage("TRANSLATION_FAILED_MESSAGE") || "Translation failed") +
              (response?.error ? ": " + response.error : "")
          );
        }
      }
    );
  } catch (error) {
    console.error("Screenshot capture error:", error);
    exitScreenshotMode();
    showDialogBox(chrome.i18n.getMessage("TRANSLATION_FAILED_MESSAGE") || "Translation failed");
  }
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

export function exitScreenshotMode() {
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