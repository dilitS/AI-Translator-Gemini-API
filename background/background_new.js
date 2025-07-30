import config from "./config.js";
import translationRequest, {
  imagePromptRequest,
  textCorrectionRequest,
} from "./translationRequest.js";
import { ApiKeyManager } from "./apiKeyManager.js";
import { handleModeResponse, handleTranslationResponse } from "./responseHandlers.js";
import { captureAndTranslateScreenshot } from "./screenshotHandler.js";

const API_URL = config.API_URL;
const apiKeyManager = new ApiKeyManager();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "translateSelectedText") {
    translateText(request.text, request.targetLanguage, sendResponse);
    return true;
  }

  if (request.action === "processText") {
    processTextByMode(request.text, request.targetLanguage, request.mode, sendResponse);
    return true;
  }

  if (request.action === "captureAndTranslateScreenshot") {
    captureAndTranslateScreenshot(
      request.area,
      request.targetLanguage,
      sendResponse,
      sender.tab.id,
      apiKeyManager
    );
    return true;
  }

  if (request.action === "getApiKeyStatus") {
    apiKeyManager
      .getKeyStatus()
      .then((status) => {
        sendResponse({ status });
      })
      .catch((error) => {
        sendResponse({ error: error.message });
      });
    return true;
  }
});

// Process text based on selected mode
async function processTextByMode(text, targetLanguage, mode, sendResponse) {
  let keyInfo = null;
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    try {
      keyInfo = await apiKeyManager.getNextAvailableKey();
      if (!text) throw new Error(config.TRANSLATION_FAILED_MESSAGE);

      let requestBody;
      
      // Create request based on mode
      switch (mode) {
        case 'translation':
          requestBody = translationRequest(text, targetLanguage);
          break;
        case 'image-prompt':
          requestBody = imagePromptRequest(text, targetLanguage);
          break;
        case 'text-correction':
          requestBody = textCorrectionRequest(text, targetLanguage);
          break;
        default:
          requestBody = translationRequest(text, targetLanguage);
      }

      const response = await fetch(`${API_URL}?key=${keyInfo.key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();

        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = response.headers.get("Retry-After") || 60;
          apiKeyManager.markKeyAsRateLimited(
            keyInfo.index,
            parseInt(retryAfter)
          );
          attempts++;
          continue; // Try next key
        }

        // Handle other errors
        const error = new Error(errorData.error?.message || "Unknown error");
        apiKeyManager.markKeyError(keyInfo.index, error.message);
        attempts++;
        continue; // Try next key
      }

      const processedText = handleModeResponse(await response.json(), mode);
      apiKeyManager.markKeySuccess(keyInfo.index);
      sendResponse({ translatedText: processedText });
      return;
    } catch (error) {
      console.error("Text processing error:", error);

      if (keyInfo) {
        apiKeyManager.markKeyError(keyInfo.index, error.message);
      }

      attempts++;

      // If this was the last attempt, send error response
      if (attempts >= maxAttempts) {
        sendResponse({
          translatedText: `${config.TRANSLATION_FAILED_MESSAGE}: ${error.message}`,
        });
        return;
      }
    }
  }
}

async function translateText(text, targetLanguage, sendResponse) {
  let keyInfo = null;
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    try {
      keyInfo = await apiKeyManager.getNextAvailableKey();
      if (!text) throw new Error(config.TRANSLATION_FAILED_MESSAGE);

      const requestBody = translationRequest(text, targetLanguage);

      const response = await fetch(`${API_URL}?key=${keyInfo.key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json();

        // Handle rate limiting
        if (response.status === 429) {
          const retryAfter = response.headers.get("Retry-After") || 60;
          apiKeyManager.markKeyAsRateLimited(
            keyInfo.index,
            parseInt(retryAfter)
          );
          attempts++;
          continue; // Try next key
        }

        // Handle other errors
        const error = new Error(errorData.error?.message || "Unknown error");
        apiKeyManager.markKeyError(keyInfo.index, error.message);
        attempts++;
        continue; // Try next key
      }

      const translatedText = handleTranslationResponse(await response.json());
      apiKeyManager.markKeySuccess(keyInfo.index);
      sendResponse({ translatedText });
      return;
    } catch (error) {
      console.error("Translation Error:", error);

      if (keyInfo) {
        apiKeyManager.markKeyError(keyInfo.index, error.message);
      }

      attempts++;

      // If this was the last attempt, send error response
      if (attempts >= maxAttempts) {
        sendResponse({
          translatedText: `${config.TRANSLATION_FAILED_MESSAGE}: ${error.message}`,
        });
        return;
      }
    }
  }
}

console.log("Service worker started.");

chrome.commands.onCommand.addListener(async (command) => {
  if (command === "_execute_ocr") {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      chrome.tabs.sendMessage(tab.id, { action: "startOCRMode" });
    }
  }
});

async function injectContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ["content/content_new.js"],
    });
    await chrome.scripting.insertCSS({
      target: { tabId: tabId },
      files: ["content/content.css"],
    });
  } catch (err) {
    console.error(`failed to inject content script into tab ${tabId}: ${err}`);
  }
}

// Inject content script into all existing tabs when the extension is installed/updated
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log("Extension installed.");
  if (details.reason === "install" || details.reason === "update") {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.url && !tab.url.startsWith("chrome://")) {
        injectContentScript(tab.id);
      }
    }
  }
});

// Inject content script into new tabs or when a tab is updated
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url && !tab.url.startsWith("chrome://")) {
    injectContentScript(tabId);
  }
});