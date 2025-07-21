console.log('🧩 Multi-platform content script loaded on', location.href);

// Platform detection
const getPlatformName = (): string => {
  const hostname = location.hostname;

  if (hostname.includes('chatgpt.com')) return 'ChatGPT';
  if (hostname.includes('claude.ai')) return 'Claude';
  if (hostname.includes('deepseek.com')) return 'DeepSeek';
  if (hostname.includes('grok.com')) return 'Grok';
  if (hostname.includes('gemini.google.com') || hostname.includes('bard.google.com')) return 'Gemini';

  return 'Unknown';
};

// Check if an element is visible on the page
const isVisible = (el: HTMLElement) => {
  const style = window.getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0' &&
    el.offsetParent !== null &&
    rect.width > 0 &&
    rect.height > 0
  );
};

// Wait for an element to appear and be visible
const waitForElement = (selector: string, timeout = 10000) =>
  new Promise<HTMLElement>((resolve, reject) => {
    const el = document.querySelector<HTMLElement>(selector);
    if (el && isVisible(el)) {
      console.log(`✅ Element found immediately with selector: ${selector}`);
      return resolve(el);
    }
    console.log(`⏳ Waiting for element with selector: ${selector}...`);
    const obs = new MutationObserver(() => {
      const found = document.querySelector<HTMLElement>(selector);
      if (found && isVisible(found)) {
        console.log(`✅ Element found with selector: ${selector}`);
        obs.disconnect();
        resolve(found);
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => {
      obs.disconnect();
      console.warn(`⚠️ Timeout: Element ${selector} not found within ${timeout}ms`);
      reject(new Error(`Visible element ${selector} not found within ${timeout}ms`));
    }, timeout);
  });

// Set text content with platform-specific handling
const setTextContent = (element: HTMLElement, text: string, platform: string) => {
  console.log(`🔧 Setting text content for ${platform}:`, text.substring(0, 50) + '...');

  if (element.tagName === 'TEXTAREA') {
    const textarea = element as HTMLTextAreaElement;
    textarea.value = ''; // Clear first
    textarea.focus();
    textarea.value = text; // Set new value
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));

    if (platform === 'Grok') {
      textarea.dispatchEvent(new Event('paste', { bubbles: true }));
      const reactKey = Object.keys(textarea).find(key => key.startsWith('__reactInternalInstance'));
      if (reactKey) {
        textarea.dispatchEvent(new Event('keyup', { bubbles: true }));
      }
    }
  } else if (element.isContentEditable) {
    element.textContent = text;
    element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
  } else {
    element.textContent = text;
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }
  element.dispatchEvent(new Event('keyup', { bubbles: true }));
};

// Get platform-specific selectors
const getInputSelectors = (platform: string): string[] => {
  switch (platform) {
    case 'ChatGPT': return ['#prompt-textarea'];
    case 'Claude': return ['div[contenteditable="true"].ProseMirror'];
    case 'DeepSeek': return ['textarea[id="chat-input"]', 'textarea[placeholder="Message DeepSeek"]'];
    case 'Grok': return ['textarea[data-grok-form-interact-field="prompt"]'];
    case 'Gemini': return ['div.ql-editor[contenteditable="true"]'];
    default: return ['textarea', 'div[contenteditable="true"]'];
  }
};

const getSendButtonSelectors = (platform: string): string[] => {
  switch (platform) {
    case 'ChatGPT': return ['button[data-testid="send-button"]'];
    case 'Claude': return ['button[aria-label="Send Message"]'];
    case 'DeepSeek': return ['div[role="button"][aria-disabled="false"]'];
    case 'Grok': return ['button[aria-label="Submit"][type="submit"]'];
    case 'Gemini': return ['button.send-arrow-button', 'button[aria-label="Send message"]'];
    default: return ['button[type="submit"]'];
  }
};

// ✨ NEW: Selectors for the latest response from the assistant
const getResponseSelectors = (platform: string): string[] => {
  switch (platform) {
    case 'ChatGPT': return ['div[data-message-author-role="assistant"] .prose'];
    case 'Claude': return ['div[data-testid*="conversation-turn"] pre.prose']; // Claude uses <pre> for code blocks which can be a good target
    case 'Gemini': return ['.model-response-text .markdown']; // Common pattern for Gemini
    case 'DeepSeek': return ['.message-content.assistant']; // Educated guess
    case 'Grok': return ['article[aria-label*="Grok"] div[dir="auto"]']; // Based on Grok's structure
    default: return ['.assistant-response', '.model-output'];
  }
};

// Platform-specific send button handling
const clickSendButton = (button: HTMLElement, platform: string) => {
  console.log(`🔧 Clicking send button for ${platform}`);
  button.click();
};

// Try Enter key as fallback
const tryEnterKey = (inputField: HTMLElement, platform:string) => {
  console.log(`🔧 Trying Enter key for ${platform}`);
  const enterEvent = new KeyboardEvent('keydown', { bubbles: true, key: 'Enter', code: 'Enter', keyCode: 13 });
  inputField.dispatchEvent(enterEvent);
};

// ✨ NEW: Function to read the latest response
const readLatestResponse = async (platform: string): Promise<string> => {
    console.log(`📖 Reading latest response from ${platform}...`);
    const selectors = getResponseSelectors(platform);
    let responseElements: NodeListOf<HTMLElement> | null = null;

    for (const selector of selectors) {
        responseElements = document.querySelectorAll<HTMLElement>(selector);
        if (responseElements && responseElements.length > 0) {
            console.log(`✅ Found ${responseElements.length} response elements with selector: ${selector}`);
            break;
        }
    }

    if (!responseElements || responseElements.length === 0) {
        throw new Error(`No response elements found for ${platform}`);
    }

    // Get the last element found
    const latestResponseElement = responseElements[responseElements.length - 1];
    if (!latestResponseElement || !latestResponseElement.textContent) {
        throw new Error('Could not extract text from the latest response element.');
    }

    console.log(`✅ Extracted response: "${latestResponseElement.textContent.substring(0, 100)}..."`);
    return latestResponseElement.textContent.trim();
};


// Main message listener
if (typeof chrome === 'undefined' || !chrome.runtime) {
  console.error('❌ Chrome extension APIs not available. This script must run as a content script.');
} else {
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    const platform = getPlatformName();

    if (msg.type === 'INJECT_PROMPT') {
      console.log(`🧩 Received INJECT_PROMPT for ${platform}`);
      const injectAndSend = async () => {
        try {
          const inputSelectors = getInputSelectors(platform);
          let inputField: HTMLElement | null = null;
          for (const selector of inputSelectors) {
            try {
              inputField = await waitForElement(selector, 2000);
              if (inputField) break;
            } catch (err) { /* continue */ }
          }
          if (!inputField) throw new Error('No visible text input found.');

          setTextContent(inputField, msg.prompt, platform);
          await new Promise(resolve => setTimeout(resolve, 300)); // Wait for UI to update

          const sendButtonSelectors = getSendButtonSelectors(platform);
          let sendButton: HTMLElement | undefined;
          for (const selector of sendButtonSelectors) {
            try {
              sendButton = await waitForElement(selector, 1000);
              if (sendButton) break;
            } catch (err) { /* continue */ }
          }

          if (sendButton) {
            clickSendButton(sendButton, platform);
          } else {
            console.warn('Send button not found, trying Enter key.');
            tryEnterKey(inputField, platform);
          }
          sendResponse({ success: true });
        } catch (err) {
          console.error(`❌ Error during INJECT_PROMPT for ${platform}:`, err);
          sendResponse({ success: false, error: err instanceof Error ? err.message : String(err) });
        }
      };
      injectAndSend();
      return true; // Indicates async response
    }
    // ✨ NEW: Handler for reading the response
    else if (msg.type === 'READ_LATEST_RESPONSE') {
        console.log(`🧩 Received READ_LATEST_RESPONSE for ${platform}`);
        readLatestResponse(platform)
            .then(response => sendResponse({ success: true, response: response }))
            .catch(err => sendResponse({ success: false, error: err.message }));
        return true; // Indicates async response
    }
  });
  console.log('🧩 Content script message listener registered successfully');
}