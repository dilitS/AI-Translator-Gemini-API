import { getLocalizedModeTitle, updateModeInterface } from '../utils/ui.js';
import { safeStorageSet } from '../utils/storage.js';

export class ModeSelector {
  constructor(elements) {
    this.elements = elements;
    this.dropdownHeader = elements.modeSelector.querySelector('.aiGeminiTranslator_dropdown-header');
    this.dropdownOptions = elements.modeSelector.querySelector('.aiGeminiTranslator_dropdown-options');
    this.dropdownTitle = elements.modeSelector.querySelector('.aiGeminiTranslator_dropdown-title');
    this.dropdownOptionElements = elements.modeSelector.querySelectorAll('.aiGeminiTranslator_dropdown-option');
    
    this.init();
  }

  init() {
    if (!this.dropdownHeader || !this.dropdownTitle || this.dropdownOptionElements.length === 0) {
      console.error('Dropdown elements not found');
      return;
    }

    this.setupEventListeners();
  }

  initializeDropdown(mode) {
    console.log('Initializing dropdown with mode:', mode);
    // Localize all dropdown options
    this.dropdownOptionElements.forEach(opt => {
      const optMode = opt.dataset.value;
      const localizedTitle = getLocalizedModeTitle(optMode);
      console.log(`Mode: ${optMode}, Localized: ${localizedTitle}`);
      opt.textContent = localizedTitle;
      opt.classList.remove('active');
      if (optMode === mode) {
        opt.classList.add('active');
        this.dropdownTitle.textContent = localizedTitle;
        console.log('Set active mode title:', localizedTitle);
      }
    });
  }

  getCurrentMode() {
    const activeOption = this.elements.modeSelector.querySelector('.aiGeminiTranslator_dropdown-option.active');
    return activeOption ? activeOption.dataset.value : 'translation';
  }

  setupEventListeners() {
    // Toggle dropdown
    this.dropdownHeader.addEventListener('click', (e) => {
      e.stopPropagation();
      this.elements.modeSelector.classList.toggle('open');
    });

    // Handle option selection
    this.dropdownOptionElements.forEach(option => {
      option.addEventListener('click', async (e) => {
        const newMode = e.target.dataset.value;
        const newTitle = getLocalizedModeTitle(newMode);

        // Update active option
        this.dropdownOptionElements.forEach(opt => opt.classList.remove('active'));
        e.target.classList.add('active');

        // Update dropdown title
        this.dropdownTitle.textContent = newTitle;

        // Close dropdown
        this.elements.modeSelector.classList.remove('open');

        // Update interface and save mode
        updateModeInterface(newMode, this.elements);
        await safeStorageSet({ currentMode: newMode });
      });
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!this.elements.modeSelector.contains(e.target)) {
        this.elements.modeSelector.classList.remove('open');
      }
    });
  }
}