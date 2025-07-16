import config from "./config.js";

// Handle response based on mode
export const handleModeResponse = (data, mode) => {
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

export const handleTranslationResponse = (data) => {
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

export const handleImagePromptResponse = (text) => {
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

export const handleTextCorrectionResponse = (text) => {
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