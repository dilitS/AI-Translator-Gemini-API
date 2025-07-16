const sanitizeInput = (text) => {
  return text.replace(/[<>]/g, "").substring(0, 5000);
};

// Map language codes to full language names for better API understanding
const getLanguageName = (langCode) => {
  const languageMap = {
    'en': 'English',
    'pl': 'Polish', 
    'de': 'German',
    'es': 'Spanish',
    'fr': 'French',
    'it': 'Italian',
    'pt': 'Portuguese',
    'ru': 'Russian',
    'zh': 'Chinese',
    'ja': 'Japanese',
    'ko': 'Korean',
    'uk': 'Ukrainian',
    'vi': 'Vietnamese'
  };
  
  // If it's already a full language name, return as is
  if (Object.values(languageMap).includes(langCode)) {
    return langCode;
  }
  
  // If it's a language code, convert to full name
  return languageMap[langCode] || langCode;
};

const translationRequest = (text, targetLanguage) => {
  const fullLanguageName = getLanguageName(targetLanguage);
  
  return {
    contents: [
      {
        parts: [
          { text: `Translate the following text to ${fullLanguageName}. Respond only with the translation, no explanations or additional text:\n\n${sanitizeInput(text)}` },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 2000,
      topP: 0.8,
    },
    safetySettings: [
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
    ],
    systemInstruction: {
      parts: [
        {
          text:
            "You are a professional translator. Your task is to translate text accurately while following these rules:\n" +
            "1. Provide ONLY the translation, no explanations or additional comments\n" +
            "2. Maintain original formatting and structure\n" +
            "3. Preserve proper nouns, names, and technical terms appropriately\n" +
            "4. Use natural, fluent grammar in the target language\n" +
            "5. Do not add prefixes like 'Translation:', 'Here is the translation:', etc.\n" +
            "6. If the text is already in the target language, still provide the best possible translation or improvement",
        },
      ],
    },
  };
};

const screenshotTranslationRequest = (targetLanguage, base64Image) => ({
  contents: [
    {
      parts: [
        {
          text: `IMPORTANT: You must provide a complete transcription of ALL visible text in this image, then translate it to ${targetLanguage}.

TASK REQUIREMENTS:
1. TRANSCRIPTION PHASE: Extract and transcribe every single piece of text visible in the image with pixel-perfect accuracy
2. TRANSLATION PHASE: Translate the transcribed text to ${targetLanguage} maintaining context and meaning

FORMAT YOUR RESPONSE EXACTLY AS:

TRANSCRIPTION:
[Write here ALL the text you can see in the image, preserving line breaks, formatting, and layout. Include even small text, watermarks, buttons, labels, etc.]

TRANSLATION:
[Write here the complete translation to ${targetLanguage} of all the transcribed text]

CRITICAL INSTRUCTIONS:
- Do NOT skip any visible text, no matter how small or unclear
- Maintain original formatting and structure
- If text is partially obscured, indicate with [unclear] but transcribe what you can see
- Include text from UI elements, buttons, menus, captions, etc.
- Preserve line breaks and spatial relationships
- Be thorough and comprehensive in your transcription`,
        },
        {
          inline_data: {
            mime_type: "image/png",
            data: base64Image,
          },
        },
      ],
    },
  ],
  generationConfig: {
    temperature: 0.2,
    topK: 32,
    topP: 1,
    maxOutputTokens: 4096,
  },
  safetySettings: [
    {
      category: "HARM_CATEGORY_HARASSMENT",
      threshold: "BLOCK_MEDIUM_AND_ABOVE",
    },
    {
      category: "HARM_CATEGORY_HATE_SPEECH",
      threshold: "BLOCK_MEDIUM_AND_ABOVE",
    },
    {
      category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
      threshold: "BLOCK_MEDIUM_AND_ABOVE",
    },
    {
      category: "HARM_CATEGORY_DANGEROUS_CONTENT",
      threshold: "BLOCK_MEDIUM_AND_ABOVE",
    },
  ],
  systemInstruction: {
    parts: [
      {
        text:
          "You are an expert OCR and translation specialist. Your task is to:\n" +
          "1. TRANSCRIBE: Extract ALL visible text from images with maximum accuracy\n" +
          "2. TRANSLATE: Provide professional translation maintaining context\n" +
          "3. PRESERVE: Keep original formatting, structure, and meaning\n" +
          "4. BE THOROUGH: Never skip text elements, even small ones\n" +
          "5. BE PRECISE: Follow the exact output format specified",
      },
    ],
  },
});

const imagePromptRequest = (text, targetLanguage) => {
  const fullLanguageName = getLanguageName(targetLanguage);
  
  return {
    contents: [
      {
        parts: [
          { text: `Improve the following image generation prompt and translate it to ${fullLanguageName}. Make it more detailed, artistic, and effective for AI image generation. Focus on visual details, style, composition, lighting, and atmosphere. Respond only with the improved prompt:\n\n${sanitizeInput(text)}` },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 2000,
      topP: 0.9,
    },
    safetySettings: [
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
    ],
    systemInstruction: {
      parts: [
        {
          text:
            "You are an expert AI image prompt engineer. Your task is to improve and translate image generation prompts by:\n" +
            "1. Adding specific visual details (colors, textures, materials)\n" +
            "2. Including artistic style references (photography style, art movement, etc.)\n" +
            "3. Specifying composition and framing details\n" +
            "4. Adding lighting and atmosphere descriptions\n" +
            "5. Including technical camera/rendering details when appropriate\n" +
            "6. Maintaining the original intent while making it more vivid and specific\n" +
            "7. Translating to the target language while preserving technical terms\n" +
            "8. Providing ONLY the improved prompt, no explanations",
        },
      ],
    },
  };
};

const textCorrectionRequest = (text, targetLanguage) => {
  const fullLanguageName = getLanguageName(targetLanguage);
  
  return {
    contents: [
      {
        parts: [
          { text: `Correct the following text in ${fullLanguageName}. Fix spelling errors, grammar mistakes, punctuation, and improve style while maintaining the original meaning. Respond only with the corrected text:\n\n${sanitizeInput(text)}` },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 2000,
      topP: 0.8,
    },
    safetySettings: [
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
    ],
    systemInstruction: {
      parts: [
        {
          text:
            "You are a professional text editor and proofreader. Your task is to correct and improve text by:\n" +
            "1. Fixing spelling errors and typos\n" +
            "2. Correcting grammar and syntax mistakes\n" +
            "3. Improving punctuation and capitalization\n" +
            "4. Enhancing sentence structure and flow\n" +
            "5. Maintaining the original meaning and tone\n" +
            "6. Using appropriate style for the text type\n" +
            "7. Preserving the author's voice and intent\n" +
            "8. Providing ONLY the corrected text, no explanations or markup",
        },
      ],
    },
  };
};

export default translationRequest;
export { screenshotTranslationRequest, imagePromptRequest, textCorrectionRequest };
