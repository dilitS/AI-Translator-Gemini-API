import { state, updateState } from '../utils/state.js';
import { elementReferences, addCleanupFunction } from '../utils/cleanup.js';

export function showTranslationIcon(event) {
  if (!state.icon) {
    state.icon = document.createElement("div");
    state.icon.className = "aiGeminiTranslator_translation-selected-text-icon";
    state.icon.innerHTML = `<img class="aiGeminiTranslator_translation-selected-text-icon-image" src="${chrome.runtime.getURL(
      "icons/icon48.png"
    )}" alt="Translate">`;
    
    // Import translateSelectedText function dynamically to avoid circular dependency
    import('./translator.js').then(({ translateSelectedText }) => {
      state.icon.addEventListener("click", translateSelectedText);
    });
    
    document.body.appendChild(state.icon);

    // Store reference in WeakMap for proper memory management
    elementReferences.set(state.icon, {
      type: "translation-icon",
      created: Date.now(),
    });
  }

  const iconRect = state.icon.getBoundingClientRect();
  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = document.documentElement.clientHeight;

  // Calculate position considering scroll
  let posX = event.clientX + window.scrollX;
  let posY = event.clientY + window.scrollY;

  // Adjust position to visible area
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

export function hideIcon() {
  if (state.icon) {
    state.icon.style.display = "none";
    // Clear any pending references
    updateState({ selectedText: null });
  }
}