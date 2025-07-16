// Storage utility functions
export async function safeStorageGet(keys) {
  try {
    if (chrome && chrome.storage && chrome.storage.local) {
      return await chrome.storage.local.get(keys);
    } else {
      console.warn('Chrome storage API not available');
      return {};
    }
  } catch (error) {
    console.error('Storage get error:', error);
    return {};
  }
}

export async function safeStorageSet(data) {
  try {
    if (chrome && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.set(data);
      return true;
    } else {
      console.warn('Chrome storage API not available');
      return false;
    }
  } catch (error) {
    console.error('Storage set error:', error);
    return false;
  }
}

export async function safeStorageRemove(keys) {
  try {
    if (chrome && chrome.storage && chrome.storage.local) {
      await chrome.storage.local.remove(keys);
      return true;
    } else {
      console.warn('Chrome storage API not available');
      return false;
    }
  } catch (error) {
    console.error('Storage remove error:', error);
    return false;
  }
}