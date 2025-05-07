import config from '../background/config.js';
import translationRequest from '../background/translationRequest.js';

// Define text elements for dynamic content
const textElements = {
    'aiGeminiTranslator_select-label': 'TEXT_TO_TRANSLATE_LABEL',
    'aiGeminiTranslator_translate-text-button': 'TRANSLATE_TEXT_BUTTON_TEXT',
    'aiGeminiTranslator_save-api-key-button': 'SAVE_API_KEY_BUTTON_TEXT',
    'aiGeminiTranslator_text-to-translate': 'TEXT_TO_TRANSLATE_PLACEHOLDER',
    'aiGeminiTranslator_translated-text': 'TRANSLATED_TEXT_PLACEHOLDER',
    'aiGeminiTranslator_text-translation-status': 'TEXT_TRANSLATION_STATUS_MESSAGE',
    'aiGeminiTranslator_api-key-input': 'API_KEY_PLACEHOLDER',
    'aiGeminiTranslator_translation-card-header-title': 'TRANSLATION_CARD_HEADER_TITLE',
    'aiGeminiTranslator_settings-card-header-title': 'SETTINGS_CARD_HEADER_TITLE',
    'aiGeminiTranslator_selected-text-language-label': 'SELECTED_TEXT_LANGUAGE_LABEL',
    'aiGeminiTranslator_api-key-label': 'API_KEY_LABEL',
    'aiGeminiTranslator_copy-icon': 'COPY_ICON_TOOLTIP'
};

const systemLanguage = chrome.i18n.getUILanguage().split('-')[0];

document.addEventListener('DOMContentLoaded', async () => {
    // Get API URL from config
    const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';
    let apiKey = '';

    // Get DOM elements
    const elements = {
        apiKeyInput: document.getElementById('aiGeminiTranslator_api-key-input'),
        recentTranslationsList: document.getElementById('aiGeminiTranslator_recent-translations-list'), // Add this line
        saveApiKeyButton: document.getElementById('aiGeminiTranslator_save-api-key-button'),
        textToTranslateTextarea: document.getElementById('aiGeminiTranslator_text-to-translate'),
        translatedTextTextarea: document.getElementById('aiGeminiTranslator_translated-text'),
        textTargetLanguageSelect: document.getElementById('aiGeminiTranslator_text-target-language'),
        translateTextButton: document.getElementById('aiGeminiTranslator_translate-text-button'),
        apiKeyStatus: document.getElementById('aiGeminiTranslator_api-key-status'),
        textTranslationStatus: document.getElementById('aiGeminiTranslator_text-translation-status'),
        settingsCard: document.querySelector('.aiGeminiTranslator_card.collapsed'),
        settingsCollapseButton: document.querySelector('.aiGeminiTranslator_card.collapsed .aiGeminiTranslator_collapse-button'),
        apiKeyStatusIcon: document.querySelector('.aiGeminiTranslator_api-key-status-icon'),
        apiKeyClearIcon: document.querySelector('.aiGeminiTranslator_api-key-clear-icon'),
        copyIcon: document.querySelector('.aiGeminiTranslator_copy-icon'),
        apiStatusTooltip: document.querySelector('.aiGeminiTranslator_api-status-tooltip'),
        selectedTextLanguageSelect: document.getElementById('aiGeminiTranslator_selected-text-language'),
        statusElement: document.getElementById('aiGeminiTranslator_status')
    };

    // Initialize text content and placeholders
    Object.entries(textElements).forEach(([id, key]) => {
        const element = document.getElementById(id);
        if (!element) return;

        if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
            element.placeholder = chrome.i18n.getMessage(key);
        } else {
            element.textContent = chrome.i18n.getMessage(key);
        }
    });

    // Load API key and target language from storage
    const { geminiApiKey, textTargetLanguage, selectedTextLanguage } = await chrome.storage.local.get(['geminiApiKey', 'textTargetLanguage', 'selectedTextLanguage']);
    if (geminiApiKey) {
        apiKey = geminiApiKey;
        elements.apiKeyInput.value = geminiApiKey;
        elements.apiKeyClearIcon.classList.add('active');
        elements.apiKeyStatusIcon.classList.add('valid');
        elements.apiStatusTooltip.textContent = chrome.i18n.getMessage('API_STATUS_VALID_TOOLTIP');
        elements.apiStatusTooltip.style.color = '#4CAF50';
    } else {
        elements.apiStatusTooltip.textContent = chrome.i18n.getMessage('API_STATUS_INVALID_TOOLTIP');
        elements.apiStatusTooltip.style.color = '#F44336';
    }

    elements.textTargetLanguageSelect.value = textTargetLanguage || config.DEFAULT_TARGET_LANGUAGE;
    elements.selectedTextLanguageSelect.value = selectedTextLanguage || 'English';

    // Focus on the text area when the popup opens
    elements.textToTranslateTextarea.focus();

    // Event listeners
    elements.settingsCollapseButton.addEventListener('click', (e) => {
        e.preventDefault();
        elements.settingsCard.classList.toggle('collapsed');
    });

    elements.apiKeyInput.addEventListener('input', () => {
        elements.apiKeyClearIcon.classList.toggle('active', !!elements.apiKeyInput.value.trim());
    });

    elements.apiKeyClearIcon.addEventListener('click', async () => {
        elements.apiKeyClearIcon.classList.remove('active');
        setTimeout(async () => {
            await chrome.storage.local.remove('geminiApiKey');
            elements.apiKeyInput.value = '';
            elements.apiKeyStatusIcon.classList.remove('valid');
        }, 300);
    });

    elements.saveApiKeyButton.addEventListener('click', async () => {
        const newApiKey = elements.apiKeyInput.value.trim();
        if (!newApiKey) return updateStatus('API_KEY_EMPTY_MESSAGE', 'red');

        updateStatus('API_KEY_VALIDATION_MESSAGE', 'orange');

        try {
            const response = await fetch(`${API_URL}?key=${newApiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config.TEST_MESSAGE_REQUEST_BODY)
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error("API Error:", errorData);
                return updateStatus('API_KEY_INVALID_MESSAGE', 'red');
            }

            const data = await response.json();
            if (!data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim().toLowerCase().includes('test')) {
                 return updateStatus('API_KEY_INVALID_MESSAGE', 'red');
            }

            updateStatus('API_KEY_VALID_MESSAGE', 'green');
            await chrome.storage.local.set({ geminiApiKey: newApiKey });
            apiKey = newApiKey;
            elements.apiKeyInput.value = newApiKey;
            elements.apiKeyClearIcon.classList.add('active');
            elements.apiKeyStatusIcon.classList.add('valid');
        } catch (error) {
            console.error("Error during API key validation:", error);
            updateStatus(`Error: ${error.message}`, 'red');
        }
    });

    elements.translateTextButton.addEventListener('click', translateText);
    elements.textTargetLanguageSelect.addEventListener('change', async () => {
        await chrome.storage.local.set({ textTargetLanguage: elements.textTargetLanguageSelect.value });
    });

    elements.copyIcon.addEventListener('click', async () => {
        const textToCopy = elements.translatedTextTextarea.value;
        
        if (!textToCopy) {
            showCopyStatus(chrome.i18n.getMessage('COPY_NO_TEXT_MESSAGE'), 'var(--copy-error-color)');
            return;
        }
        
        try {
            await navigator.clipboard.writeText(textToCopy);
            showCopyStatus(chrome.i18n.getMessage('COPY_SUCCESS_MESSAGE'), 'var(--text-color)');
        } catch (err) {
            console.error('Failed to copy text:', err);
            showCopyStatus(chrome.i18n.getMessage('COPY_FAILED_MESSAGE'), 'var(--copy-error-color)');
        }
    });

    elements.copyIcon.title = chrome.i18n.getMessage('COPY_ICON_TOOLTIP');

    elements.selectedTextLanguageSelect.addEventListener('change', async () => {
        const newValue = elements.selectedTextLanguageSelect.value;
        await chrome.storage.local.set({ selectedTextLanguage: newValue });

        // Zaktualizuj widok selecta
        initializeSelects();
    });

    // Add event listener for translate button to save translation
    elements.translateTextButton.addEventListener('click', async () => {
        await translateText();
        await saveTranslation(); // Save the translation after successful translation
        await loadAndDisplayRecentTranslations(); // Refresh the list
    });

    // Add event listener for Enter key in textarea to save translation
    elements.textToTranslateTextarea.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            await translateText();
            await saveTranslation(); // Save the translation after successful translation
            await loadAndDisplayRecentTranslations(); // Refresh the list
        }
    });

    chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'local') {
            if (changes.geminiApiKey) {
                elements.apiKeyInput.value = changes.geminiApiKey.newValue || '';
                elements.apiKeyClearIcon.classList.toggle('active', !!changes.geminiApiKey.newValue);
            }
            if (changes.textTargetLanguage) elements.textTargetLanguageSelect.value = changes.textTargetLanguage.newValue;
            if (changes.apiKeyStatus) {
                const icon = changes.apiKeyStatus.newValue === 'valid' 
                    ? 'valid'
                    : 'invalid';
                elements.apiKeyStatusIcon.classList.toggle('valid', icon === 'valid');
                elements.apiKeyStatusIcon.classList.toggle('invalid', icon === 'invalid');
            }
            if (changes.selectedTextLanguage) elements.selectedTextLanguageSelect.value = changes.selectedTextLanguage.newValue;
        }
    });

    // Timeout IDs for status messages
    let apiKeyStatusTimeoutId = null;
    let translationStatusTimeoutId = null;

    function updateStatus(messageKey, color) {
        elements.apiKeyStatus.textContent = chrome.i18n.getMessage(messageKey);
        elements.apiKeyStatus.style.color = color;
        
        if (color === 'green') {
            elements.apiKeyStatusIcon.classList.add('valid');
            elements.apiKeyStatusIcon.classList.remove('invalid');
            elements.apiKeyClearIcon.style.display = 'block';
        } else {
            elements.apiKeyStatusIcon.classList.add('invalid');
            elements.apiKeyStatusIcon.classList.remove('valid');
            elements.apiKeyClearIcon.style.display = 'none';
        }
        
        // Automatyczne chowanie komunikatu tekstowego
        elements.apiKeyStatus.style.display = 'block';
        clearTimeout(apiKeyStatusTimeoutId);
        apiKeyStatusTimeoutId = setTimeout(() => {
            elements.apiKeyStatus.style.display = 'none';
        }, 5000);

        // Aktualizuj treść i kolor tooltipa
        const hasValidApiKey = color === 'green';
        elements.apiStatusTooltip.textContent = hasValidApiKey 
            ? chrome.i18n.getMessage('API_STATUS_VALID_TOOLTIP') 
            : chrome.i18n.getMessage('API_STATUS_INVALID_TOOLTIP');
        elements.apiStatusTooltip.style.color = hasValidApiKey ? '#4CAF50' : '#F44336';
        
        // Aktualizuj klasę ikony statusu
        elements.apiKeyStatusIcon.classList.toggle('valid', hasValidApiKey);
        elements.apiKeyStatusIcon.classList.toggle('invalid', !hasValidApiKey);
    }

    function updateTranslationStatus(messageKey, color) {
        elements.textTranslationStatus.textContent = chrome.i18n.getMessage(messageKey);
        elements.textTranslationStatus.style.color = color;
        elements.textTranslationStatus.style.display = 'block';
        
        clearTimeout(translationStatusTimeoutId);
        translationStatusTimeoutId = setTimeout(() => {
            elements.textTranslationStatus.style.display = 'none';
        }, color === 'green' ? 3000 : 5000);
    }

    async function translateText() {
        if (!apiKey) return updateTranslationStatus('API_KEY_NOT_SET_MESSAGE', 'red');

        const text = elements.textToTranslateTextarea.value.trim();
        const targetLanguage = elements.textTargetLanguageSelect.value;

        if (!text) return updateTranslationStatus('TEXT_TO_TRANSLATE_EMPTY_MESSAGE', 'red');

        updateTranslationStatus('TRANSLATION_IN_PROGRESS_MESSAGE', 'yellow');
        elements.translatedTextTextarea.value = '';
        elements.translateTextButton.disabled = true; // Disable button while translating
        elements.translateTextButton.textContent = chrome.i18n.getMessage('TRANSLATING_BUTTON_TEXT'); // Change button text

        try {
            const response = await fetch(`${API_URL}?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(translationRequest(text, targetLanguage))
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error("API Error:", errorData);
                return updateTranslationStatus(`${chrome.i18n.getMessage('TRANSLATION_FAILED_MESSAGE')}: ${errorData.error?.message || 'Unknown error'}`, 'red');
            }

            const data = await response.json();
            if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
                elements.translatedTextTextarea.value = data.candidates[0].content.parts[0].text
                    .replace(/^["']|["']$/g, '')
                    .replace(/^Translate to.*?: /i, '');
                updateTranslationStatus('TRANSLATION_COMPLETE_MESSAGE', 'green');
            } else {
                updateTranslationStatus('TRANSLATION_FAILED_MESSAGE', 'red');
            }
        } catch (error) {
            handleError(error, 'translateText');
        } finally {
            elements.translateTextButton.disabled = false; // Re-enable button
            elements.translateTextButton.textContent = chrome.i18n.getMessage('TRANSLATE_TEXT_BUTTON_TEXT'); // Restore button text
        }
    }

    elements.textToTranslateTextarea.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            translateText();
        }
    });

    // Na początku pliku dodaj zmienne CSS
    document.documentElement.style.setProperty('--valid-icon', `url("${config.VALID_ICON_SVG}")`);
    document.documentElement.style.setProperty('--invalid-icon', `url("${config.INVALID_ICON_SVG}")`);
    document.documentElement.style.setProperty('--copy-icon', `url("${config.COPY_ICON_SVG}")`);
    document.documentElement.style.setProperty('--copy-error-color', '#ff4444');

    // Dodaj nową funkcję statusu kopiowania
    function showCopyStatus(message, color) {
        const tooltip = document.querySelector('.aiGeminiTranslator_copy-tooltip');
        if (!tooltip) {
            console.error("Tooltip element not found!");
            return;
        }
        tooltip.textContent = message;
        tooltip.style.color = color;
        tooltip.classList.add('visible');
        
        setTimeout(() => {
            tooltip.classList.remove('visible');
        }, 2000);
    }

    // Function to save a translation
    async function saveTranslation() {
        const originalText = elements.textToTranslateTextarea.value.trim();
        const translatedText = elements.translatedTextTextarea.value.trim();

        if (!originalText || !translatedText) return;

        const newTranslation = {
            id: Date.now(), // Simple unique ID
            originalText: originalText,
            translatedText: translatedText,
            timestamp: new Date().toISOString(),
            starred: false,
            title: ''
        };

        const { recentTranslations = [] } = await chrome.storage.local.get('recentTranslations');
        recentTranslations.unshift(newTranslation); // Add to the beginning of the array

        // Limit the number of translations if needed (optional, but good practice)
        // const maxTranslations = 50; // Example limit
        // if (recentTranslations.length > maxTranslations) {
        //     recentTranslations = recentTranslations.slice(0, maxTranslations);
        // }

        await chrome.storage.local.set({ recentTranslations });
    }

    // Function to load and display recent translations
    async function loadAndDisplayRecentTranslations() {
        const { recentTranslations = [] } = await chrome.storage.local.get('recentTranslations');
        const now = Date.now();
        const sevenDaysInMillis = 7 * 24 * 60 * 60 * 1000;

        // Filter out old translations that are not starred
        const filteredTranslations = recentTranslations.filter(translation => {
            if (translation.starred) return true;
            const translationTimestamp = new Date(translation.timestamp).getTime();
            return (now - translationTimestamp) <= sevenDaysInMillis;
        });

        // Update storage with filtered translations
        await chrome.storage.local.set({ recentTranslations: filteredTranslations });

        renderRecentTranslations(filteredTranslations);
    }

    // Function to render recent translations in the list
    function renderRecentTranslations(translations) {
        elements.recentTranslationsList.innerHTML = ''; // Clear current list

        if (translations.length === 0) {
            elements.recentTranslationsList.innerHTML = `<li>${chrome.i18n.getMessage('NO_RECENT_TRANSLATIONS')}</li>`;
            return;
        }

        translations.forEach(translation => {
            const listItem = document.createElement('li');
            listItem.dataset.id = translation.id;

            listItem.innerHTML = `
                <div class="translation-item-header">
                    <span class="title" contenteditable="true">${translation.title || translation.originalText.substring(0, 50) + '...'}</span>
                    <div class="actions">
                        <span class="icon star-icon ${translation.starred ? 'starred' : ''}" title="${chrome.i18n.getMessage('STAR_TRANSLATION')}">⭐</span>
                        <span class="icon copy-icon" title="${chrome.i18n.getMessage('COPY_TRANSLATION')}">📋</span>
                        <span class="icon delete-icon" title="${chrome.i18n.getMessage('DELETE_TRANSLATION')}">🗑️</span>
                    </div>
                </div>
                <div class="translation-text">${translation.translatedText}</div>
            `;

            // Add event listeners for icons and title editing
            listItem.querySelector('.star-icon').addEventListener('click', handleStarClick);
            listItem.querySelector('.copy-icon').addEventListener('click', handleCopyClick);
            listItem.querySelector('.delete-icon').addEventListener('click', handleDeleteClick);
            listItem.querySelector('.title').addEventListener('blur', handleTitleEdit); // Add event listener for title editing

            elements.recentTranslationsList.appendChild(listItem);
        });
    }

    // Event handler for title editing
    async function handleTitleEdit(event) {
        const listItem = event.target.closest('li');
        const translationId = parseInt(listItem.dataset.id);
        const newTitle = event.target.textContent.trim();

        const { recentTranslations = [] } = await chrome.storage.local.get('recentTranslations');
        const updatedTranslations = recentTranslations.map(translation => {
            if (translation.id === translationId) {
                return { ...translation, title: newTitle };
            }
            return translation;
        });

        await chrome.storage.local.set({ recentTranslations: updatedTranslations });
        // No need to re-render the whole list, the contenteditable span is already updated
    }

    // Event handler for star icon click
    async function handleStarClick(event) {
        const listItem = event.target.closest('li');
        const translationId = parseInt(listItem.dataset.id);

        const { recentTranslations = [] } = await chrome.storage.local.get('recentTranslations');
        const updatedTranslations = recentTranslations.map(translation => {
            if (translation.id === translationId) {
                return { ...translation, starred: !translation.starred };
            }
            return translation;
        });

        await chrome.storage.local.set({ recentTranslations: updatedTranslations });
        loadAndDisplayRecentTranslations(); // Refresh the list
    }

    // Event handler for copy icon click
    async function handleCopyClick(event) {
        const listItem = event.target.closest('li');
        const translatedText = listItem.querySelector('.translation-text').textContent;

        try {
            await navigator.clipboard.writeText(translatedText);
            // Optional: Show a temporary confirmation message
            console.log('Copied to clipboard:', translatedText);
        } catch (err) {
            console.error('Failed to copy text:', err);
        }
    }

    // Event handler for delete icon click
    async function handleDeleteClick(event) {
        const listItem = event.target.closest('li');
        const translationId = parseInt(listItem.dataset.id);

        // Add confirmation dialog
        const confirmed = confirm(chrome.i18n.getMessage('CONFIRM_DELETE_TRANSLATION'));
        if (!confirmed) {
            return; // Do nothing if not confirmed
        }

        const { recentTranslations = [] } = await chrome.storage.local.get('recentTranslations');
        const updatedTranslations = recentTranslations.filter(translation => translation.id !== translationId);

        await chrome.storage.local.set({ recentTranslations: updatedTranslations });
        loadAndDisplayRecentTranslations(); // Refresh the list
    }


    // Uproszczona inicjalizacja
    const initializeSelects = async () => {
        const { 
            textTargetLanguage = systemLanguage,
            selectedTextLanguage = systemLanguage 
        } = await chrome.storage.local.get(['textTargetLanguage', 'selectedTextLanguage']);

        [elements.textTargetLanguageSelect, elements.selectedTextLanguageSelect].forEach((select, index) => {
            select.innerHTML = config.LANGUAGES.map(lang => 
                `<option value="${lang.value}" ${lang.value === (index ? selectedTextLanguage : textTargetLanguage) ? 'selected' : ''}>
                    ${lang.label}
                </option>`
            ).join('');
        });
    };

    // Wywołanie w DOMContentLoaded
    await initializeSelects();

    const setupEventListeners = () => {
        const handlers = {
            'input #apiKeyInput': handleApiKeyInput,
            'click #saveButton': handleSaveApiKey,
            'change .language-select': handleLanguageChange
        };

        Object.entries(handlers).forEach(([event, handler]) => {
            const [eventType, selector] = event.split(' ');
            document.querySelector(selector).addEventListener(eventType, handler);
        });
    };

    function updateLanguageSwitcher() {
        const langSelect = document.getElementById('language-switcher');
        langSelect.innerHTML = Object.keys(chrome.i18n.getAcceptLanguages())
            .map(lang => `<option value="${lang}">${lang}</option>`)
            .join('');
        
        langSelect.addEventListener('change', () => {
            chrome.storage.local.set({ preferredLanguage: langSelect.value });
            window.location.reload();
        });
    }
});
