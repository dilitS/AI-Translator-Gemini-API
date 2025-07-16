import config from "./config.js";
import translationRequest, {
  screenshotTranslationRequest,
  imagePromptRequest,
  textCorrectionRequest,
} from "./translationRequest.js";

const API_URL = config.API_URL;

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
      sender.tab.id
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

// API Key Pool Management
class ApiKeyManager {
  constructor() {
    this.apiKeys = [];
    this.currentKeyIndex = 0;
    this.keyStatus = new Map(); // Track health status of each key
    this.rateLimitRetryAfter = new Map(); // Track rate limit cooldowns
  }

  async loadApiKeys() {
    const { geminiApiKeys, geminiApiKey } = await chrome.storage.local.get([
      "geminiApiKeys",
      "geminiApiKey",
    ]);

    // Migrate single API key to array format if needed
    if (geminiApiKey && !geminiApiKeys) {
      this.apiKeys = [geminiApiKey];
      await chrome.storage.local.set({ geminiApiKeys: this.apiKeys });
    } else {
      this.apiKeys = geminiApiKeys || [];
    }

    // Initialize status for all keys
    this.apiKeys.forEach((key) => {
      if (!this.keyStatus.has(key)) {
        this.keyStatus.set(key, {
          healthy: true,
          lastError: null,
          errorCount: 0,
        });
      }
    });
  }

  async getNextAvailableKey() {
    await this.loadApiKeys();

    if (this.apiKeys.length === 0) {
      throw new Error(config.API_KEY_NOT_SET_MESSAGE);
    }

    const now = Date.now();
    let attempts = 0;

    // Try each key in rotation
    while (attempts < this.apiKeys.length) {
      const currentKey = this.apiKeys[this.currentKeyIndex];
      const keyStatus = this.keyStatus.get(currentKey);
      const rateLimitInfo = this.rateLimitRetryAfter.get(currentKey);

      // Check if key is available (not rate limited and healthy)
      const isRateLimited = rateLimitInfo && now < rateLimitInfo.retryAfter;
      const isTooManyErrors = keyStatus && keyStatus.errorCount >= 3;

      if (!isRateLimited && !isTooManyErrors) {
        return {
          key: currentKey,
          index: this.currentKeyIndex,
        };
      }

      // Move to next key
      this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
      attempts++;
    }

    throw new Error(
      "All API keys are currently unavailable due to rate limits or errors"
    );
  }

  markKeyAsRateLimited(keyIndex, retryAfterSeconds = 60) {
    const key = this.apiKeys[keyIndex];
    if (key) {
      const retryAfter = Date.now() + retryAfterSeconds * 1000;
      this.rateLimitRetryAfter.set(key, { retryAfter, timestamp: Date.now() });
      console.log(
        `API key ${
          keyIndex + 1
        } rate limited, retry after ${retryAfterSeconds}s`
      );
    }
  }

  markKeyError(keyIndex, error) {
    const key = this.apiKeys[keyIndex];
    if (key) {
      const status = this.keyStatus.get(key) || {
        healthy: true,
        lastError: null,
        errorCount: 0,
      };
      status.errorCount++;
      status.lastError = error;
      status.healthy = status.errorCount < 3;
      this.keyStatus.set(key, status);
      console.log(`API key ${keyIndex + 1} error count: ${status.errorCount}`);
    }
  }

  markKeySuccess(keyIndex) {
    const key = this.apiKeys[keyIndex];
    if (key) {
      // Reset error count on successful request
      const status = this.keyStatus.get(key) || {
        healthy: true,
        lastError: null,
        errorCount: 0,
      };
      status.errorCount = Math.max(0, status.errorCount - 1);
      status.healthy = true;
      status.lastError = null;
      this.keyStatus.set(key, status);
    }
  }

  async getKeyStatus() {
    await this.loadApiKeys();
    const now = Date.now();

    return this.apiKeys.map((key, index) => {
      const status = this.keyStatus.get(key) || {
        healthy: true,
        lastError: null,
        errorCount: 0,
      };
      const rateLimitInfo = this.rateLimitRetryAfter.get(key);
      const isRateLimited = rateLimitInfo && now < rateLimitInfo.retryAfter;

      return {
        index: index + 1,
        key: key.substring(0, 8) + "..." + key.substring(key.length - 4), // Masked key
        healthy: status.healthy,
        errorCount: status.errorCount,
        isRateLimited,
        rateLimitEndsIn: isRateLimited
          ? Math.ceil((rateLimitInfo.retryAfter - now) / 1000)
          : 0,
      };
    });
  }
}

const apiKeyManager = new ApiKeyManager();

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

// Handle response based on mode
const handleModeResponse = (data, mode) => {
  const candidate = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!candidate) throw new Error(config.TRANSLATION_FAILED_MESSAGE);

  let cleanedText = candidate.trim();
  
  // Remove surrounding quotes if they wrap the entire text
  if ((cleanedText.startsWith('"') && cleanedText.endsWith('"')) ||
      (cleanedText.startsWith("'") && cleanedText.endsWith("'"))) {
    cleanedText = cleanedText.slice(1, -1);
  }
  
  // Mode-specific response cleaning
  switch (mode) {
    case 'translation':
      return handleTranslationResponse(data);
    case 'image-prompt':
      return handleImagePromptResponse(cleanedText);
    case 'text-correction':
      return handleTextCorrectionResponse(cleanedText);
    default:
      return handleTranslationResponse(data);
  }
};

const handleTranslationResponse = (data) => {
  const candidate = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!candidate) throw new Error(config.TRANSLATION_FAILED_MESSAGE);

  // Clean up the response more carefully
  let cleanedText = candidate.trim();
  
  // Remove surrounding quotes if they wrap the entire text
  if ((cleanedText.startsWith('"') && cleanedText.endsWith('"')) ||
      (cleanedText.startsWith("'") && cleanedText.endsWith("'"))) {
    cleanedText = cleanedText.slice(1, -1);
  }
  
  // Remove common prefixes that Gemini might add, but be more careful
  const prefixPatterns = [
    /^Translate to [^:]+:\s*/i,
    /^Translation:\s*/i,
    /^Here is the translation:\s*/i,
    /^The translation is:\s*/i
  ];
  
  for (const pattern of prefixPatterns) {
    if (pattern.test(cleanedText)) {
      cleanedText = cleanedText.replace(pattern, '');
      break; // Only remove the first matching pattern
    }
  }
  
  return cleanedText.trim();
};

const handleImagePromptResponse = (text) => {
  // Remove common prefixes for image prompt improvement
  const prefixPatterns = [
    /^Improved prompt:\s*/i,
    /^Enhanced prompt:\s*/i,
    /^Here's an improved version:\s*/i,
    /^Improved version:\s*/i
  ];
  
  let cleanedText = text;
  for (const pattern of prefixPatterns) {
    if (pattern.test(cleanedText)) {
      cleanedText = cleanedText.replace(pattern, '');
      break;
    }
  }
  
  return cleanedText.trim();
};

const handleTextCorrectionResponse = (text) => {
  // Remove common prefixes for text correction
  const prefixPatterns = [
    /^Corrected text:\s*/i,
    /^Here's the corrected version:\s*/i,
    /^Corrected version:\s*/i,
    /^Fixed text:\s*/i
  ];
  
  let cleanedText = text;
  for (const pattern of prefixPatterns) {
    if (pattern.test(cleanedText)) {
      cleanedText = cleanedText.replace(pattern, '');
      break;
    }
  }
  
  return cleanedText.trim();
};

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

async function captureAndTranslateScreenshot(
  area,
  targetLanguage,
  sendResponse,
  tabId
) {
  console.log("captureAndTranslateScreenshot called with:", { area, targetLanguage, tabId });
  
  let keyInfo = null;
  let attempts = 0;
  const maxAttempts = 3;

  try {
    console.log("Capturing visible tab...");
    // Capture visible tab
    const screenshot = await chrome.tabs.captureVisibleTab(null, {
      format: "png",
      quality: 100,
    });
    
    console.log("Screenshot captured, cropping image...");
    // Crop the screenshot to the selected area
    const croppedImage = await cropImage(screenshot, area);

    // Convert to base64 format for Gemini API
    const base64Image = croppedImage.split(",")[1];

    // Create vision request using the specialized function
    const visionRequest = screenshotTranslationRequest(
      targetLanguage,
      base64Image
    );

    while (attempts < maxAttempts) {
      try {
        keyInfo = await apiKeyManager.getNextAvailableKey();

        const response = await fetch(`${API_URL}?key=${keyInfo.key}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(visionRequest),
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

        const data = await response.json();
        const result = handleTranslationResponse(data);

        // Extract translation part with improved pattern matching
        const translationMatch = result.match(
          /TRANSLATION:\s*([\s\S]*?)(?=\n\n|$)/
        );
        let translatedText = translationMatch
          ? translationMatch[1].trim()
          : result;

        // Fallback: if no TRANSLATION section found, return the whole result
        if (!translationMatch && result.includes("TRANSCRIPTION:")) {
          // If we have transcription but no clear translation, try to extract after transcription
          const afterTranscription = result.split("TRANSCRIPTION:")[1];
          if (afterTranscription) {
            translatedText = afterTranscription
              .replace(/^[\s\S]*?TRANSLATION:\s*/, "")
              .trim();
          }
        }

        // Clean up any remaining formatting artifacts
        translatedText = translatedText
          .replace(/^\[.*?\]\s*/, "")
          .replace(/\[unclear\]/g, "")
          .trim();

        apiKeyManager.markKeySuccess(keyInfo.index);
        sendResponse({ translatedText });
        return;
      } catch (error) {
        console.error("Screenshot translation error:", error);

        if (keyInfo) {
          apiKeyManager.markKeyError(keyInfo.index, error.message);
        }

        attempts++;

        // If this was the last attempt, send error response
        if (attempts >= maxAttempts) {
          sendResponse({
            error: error.message,
            translatedText: `${config.TRANSLATION_FAILED_MESSAGE}: ${error.message}`,
          });
          return;
        }
      }
    }
  } catch (error) {
    console.error("Screenshot capture error:", error);
    sendResponse({
      error: error.message,
      translatedText: `${config.TRANSLATION_FAILED_MESSAGE}: ${error.message}`,
    });
  }
}

function cropImage(dataUrl, area) {
  return new Promise((resolve, reject) => {
    console.log("Cropping image with area:", area);
    
    try {
      // Create offscreen canvas for service worker compatibility
      const canvas = new OffscreenCanvas(area.width, area.height);
      const ctx = canvas.getContext("2d");
      
      // Create image bitmap from data URL
      fetch(dataUrl)
        .then(response => response.blob())
        .then(blob => createImageBitmap(blob))
        .then(imageBitmap => {
          console.log("Image bitmap created, drawing to canvas...");
          
          ctx.drawImage(
            imageBitmap,
            area.left,
            area.top,
            area.width,
            area.height,
            0,
            0,
            area.width,
            area.height
          );

          // Convert to blob and then to data URL
          canvas.convertToBlob({ type: 'image/png' })
            .then(blob => {
              const reader = new FileReader();
              reader.onload = () => {
                console.log("Image cropped successfully");
                resolve(reader.result);
              };
              reader.onerror = () => {
                console.error("Failed to convert blob to data URL");
                reject(new Error("Failed to convert blob to data URL"));
              };
              reader.readAsDataURL(blob);
            })
            .catch(error => {
              console.error("Failed to convert canvas to blob:", error);
              reject(error);
            });
        })
        .catch(error => {
          console.error("Failed to create image bitmap:", error);
          reject(error);
        });
    } catch (error) {
      console.error("Error in cropImage:", error);
      reject(error);
    }
  });
}

// Language synchronization removed - selected text and popup translator now have independent language settings

console.log("Service worker started.");
chrome.runtime.onInstalled.addListener(() => {
  console.log("Extension installed.");
});
