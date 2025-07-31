import { cleanup, addCleanupFunction } from './utils/cleanup.js';
import { startScreenshotMode } from './components/screenshotMode.js';
import { translateSelectedText } from './components/translator.js';
import { 
  handleMouseUp, 
  handleMouseDown, 
  handleMouseMove, 
  handleKeyEvents, 
  handleContextMenu 
} from './utils/eventHandlers.js';

// Content script loaded
console.log('Content script loaded');

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "startOCRMode") {
    console.log("Received startOCRMode message from popup");
    startScreenshotMode();
    sendResponse({ success: true });
  }
  return true;
});

// Register event listeners with cleanup
document.addEventListener("mouseup", handleMouseUp);
document.addEventListener("mousedown", handleMouseDown);
document.addEventListener("mousemove", handleMouseMove);
document.addEventListener("keydown", handleKeyEvents);
document.addEventListener("contextmenu", handleContextMenu);
document.addEventListener('gemini-translator-translate', translateSelectedText);


// Register cleanup functions
addCleanupFunction(() => {
  document.removeEventListener("mouseup", handleMouseUp);
  document.removeEventListener("mousedown", handleMouseDown);
  document.removeEventListener("mousemove", handleMouseMove);
  document.removeEventListener("keydown", handleKeyEvents);
  document.removeEventListener("contextmenu", handleContextMenu);
  document.removeEventListener('gemini-translator-translate', translateSelectedText);
});

console.log('Content script event listeners registered');