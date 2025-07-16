import config from "./config.js";
import { screenshotTranslationRequest } from "./translationRequest.js";
import { handleTranslationResponse } from "./responseHandlers.js";

const API_URL = config.API_URL;

export async function captureAndTranslateScreenshot(
  area,
  targetLanguage,
  sendResponse,
  tabId,
  apiKeyManager
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