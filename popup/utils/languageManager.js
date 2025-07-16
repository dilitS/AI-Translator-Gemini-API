import config from "../../background/config.js";
import { safeStorageGet, safeStorageSet } from './storage.js';
import { systemLanguage } from './constants.js';

export class LanguageManager {
  constructor(elements) {
    this.elements = elements;
    this.init();
  }

  async init() {
    await this.initializeSelects();
    this.setupEventListeners();
  }

  async initializeSelects() {
    const storageData = await safeStorageGet([
      "textTargetLanguage",
      "selectedTextLanguage",
    ]);

    const textTargetLanguage = storageData.textTargetLanguage || systemLanguage;
    const selectedTextLanguage = storageData.selectedTextLanguage || systemLanguage;

    [
      this.elements.textTargetLanguageSelect,
      this.elements.selectedTextLanguageSelect,
    ].forEach((select, index) => {
      if (!select) return;
      
      select.innerHTML = config.LANGUAGES.map(
        (lang) =>
          `<option value="${lang.value}" ${
            lang.value === (index ? selectedTextLanguage : textTargetLanguage)
              ? "selected"
              : ""
          }>
            ${lang.label}
          </option>`
      ).join("");
    });
  }

  setupEventListeners() {
    if (this.elements.textTargetLanguageSelect) {
      this.elements.textTargetLanguageSelect.addEventListener('change', async (e) => {
        await safeStorageSet({ textTargetLanguage: e.target.value });
      });
    }

    if (this.elements.selectedTextLanguageSelect) {
      this.elements.selectedTextLanguageSelect.addEventListener('change', async (e) => {
        await safeStorageSet({ selectedTextLanguage: e.target.value });
      });
    }
  }

  updateLanguageSwitcher() {
    const langSelect = document.getElementById("language-switcher");
    if (!langSelect) return;

    langSelect.innerHTML = Object.keys(chrome.i18n.getAcceptLanguages())
      .map((lang) => `<option value="${lang}">${lang}</option>`)
      .join("");

    langSelect.addEventListener("change", () => {
      safeStorageSet({ preferredLanguage: langSelect.value });
      window.location.reload();
    });
  }
}