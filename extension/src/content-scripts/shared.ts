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
    // Clear first
    textarea.value = '';
    textarea.focus();

    // Set new value
    textarea.value = text;

    // Dispatch events
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));

    // For Grok, also try paste event
    if (platform === 'Grok') {
      textarea.dispatchEvent(new Event('paste', { bubbles: true }));
      // Trigger any potential React state updates
      const reactKey = Object.keys(textarea).find(key => key.startsWith('__reactInternalInstance'));
      if (reactKey) {
        textarea.dispatchEvent(new Event('keyup', { bubbles: true }));
      }
    }
  } else if (element.isContentEditable) {
    // For contenteditable elements
    element.textContent = text;
    element.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      inputType: 'insertText',
      data: text
    }));
  } else {
    // Fallback
    element.textContent = text;
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }

  // Additional events that some platforms might need
  element.dispatchEvent(new Event('keyup', { bubbles: true }));
};

// Get platform-specific selectors
const getInputSelectors = (platform: string): string[] => {
  switch (platform) {
    case 'ChatGPT':
      return [
        '#prompt-textarea[contenteditable="true"]',
        'div[contenteditable="true"].ProseMirror',
        'textarea[data-testid="prompt-textarea"]:not([style*="display: none"])',
        'textarea[placeholder*="Message"]',
        'div[contenteditable="true"][data-testid="prompt-textarea"]'
      ];

    case 'Claude':
      return [
        'div[contenteditable="true"][data-testid="chat-input"]',
        'div[contenteditable="true"].ProseMirror',
        'textarea[placeholder*="Talk to Claude"]',
        'div[contenteditable="true"][placeholder*="Talk to Claude"]',
        'div[contenteditable="true"][role="textbox"]'
      ];

    case 'DeepSeek': // ✨ FIXED
      return [
        'textarea[id="chat-input"]', // Most specific selector from screenshot
        'textarea[placeholder="Message DeepSeek"]' // Fallback based on placeholder
      ];

    case 'Grok':
      return [
        'textarea[data-grok-form-interact-field="prompt"]',
        'textarea[aria-label="Ask Grok anything"]',
        'textarea[placeholder="What do you want to know?"]',
        'form textarea:not([style*="display: none"])'
      ];

    case 'Gemini':
      return [
        'div.ql-editor[contenteditable="true"]',
        'div[contenteditable="true"][aria-label="Enter a prompt here"]',
        'div[contenteditable="true"][role="textbox"]'
      ];

    default:
      return [
        'div[contenteditable="true"]',
        'textarea[placeholder*="message" i]',
        'textarea[placeholder*="prompt" i]',
        'div[contenteditable="true"][role="textbox"]'
      ];
  }
};

const getSendButtonSelectors = (platform: string): string[] => {
  switch (platform) {
    case 'ChatGPT':
      return [
        'button[data-testid="send-button"]',
        'button[aria-label="Send prompt"]',
        'button[type="submit"]',
        'button:has(svg[data-testid="send-button"])'
      ];

    case 'Claude':
      return [
        'button[aria-label="Send Message"]',
        'button[data-testid="send-button"]',
        'button[type="submit"]'
      ];

    case 'DeepSeek': // ✨ FIXED
      return [
        'div[role="button"][aria-disabled="false"]', // Specific selector from screenshot
        'div[role="button"]:not([aria-disabled="true"])' // More general fallback
      ];

    case 'Grok':
      return [
        'button[aria-label="Submit"][type="submit"]',
        'form button[type="submit"]:not(:disabled)',
        'button[aria-label="Submit"]:not(:disabled)'
      ];
    
    case 'Gemini':
      return [
        'button[aria-label="Send message"]',
        'button[data-testid="send-button"]',
        'button.send-arrow-button'
      ];

    default:
      return [
        'button[aria-label*="Send" i]',
        'button[data-testid*="send"]',
        'button[type="submit"]',
        'form button:not(:disabled)'
      ];
  }
};

// Platform-specific send button handling
const clickSendButton = (button: HTMLElement, platform: string) => {
  console.log(`🔧 Clicking send button for ${platform}`);

  if (platform === 'Grok') {
    // Grok might need special handling
    button.focus();

    // Try mousedown/mouseup sequence first
    button.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    setTimeout(() => {
      button.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
      button.click();
    }, 50);
  } else {
    // Default click handling
    button.click();
  }
};

// Try Enter key as fallback
const tryEnterKey = (inputField: HTMLElement, platform: string) => {
  console.log(`🔧 Trying Enter key for ${platform}`);

  const enterEvent = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    key: 'Enter',
    code: 'Enter',
    keyCode: 13,
    which: 13
  });

  inputField.dispatchEvent(enterEvent);

  // Also try keyup
  inputField.dispatchEvent(new KeyboardEvent('keyup', {
    bubbles: true,
    cancelable: true,
    key: 'Enter',
    code: 'Enter',
    keyCode: 13,
    which: 13
  }));

  // For Grok, also try Ctrl+Enter
  if (platform === 'Grok') {
    inputField.dispatchEvent(new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      ctrlKey: true
    }));
  }
};

// Check if Chrome extension APIs are available
if (typeof chrome === 'undefined' || !chrome.runtime) {
  console.error('❌ Chrome extension APIs not available. This script must run as a content script.');
} else {
  // Listen for messages from the Chrome extension
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type !== 'INJECT_PROMPT') return;

    const platform = getPlatformName();
    console.log(`🧩 Received INJECT_PROMPT message for ${platform} with prompt:`, msg.prompt);

    const injectAndSend = async () => {
      try {
        // Step 1: Find the visible text input
        console.log(`🧩 Step 1: Locating text input for ${platform}...`);
        let inputField: HTMLElement | null = null;
        const inputSelectors = getInputSelectors(platform);

        for (const selector of inputSelectors) {
          try {
            console.log(`Trying selector: ${selector}`);
            inputField = await waitForElement(selector, 2000);
            if (inputField) {
              console.log(`✅ Found text input with selector: ${selector}`);
              break;
            }
          } catch (err) {
            console.log(`Selector ${selector} not found within timeout`);
          }
        }

        if (!inputField) {
          throw new Error(`No visible text input found for ${platform} after trying all selectors`);
        }

        // Step 2: Focus and set the text content
        console.log(`🧩 Step 2: Setting text content for ${platform}...`);
        inputField.focus();

        // Clear existing content first
        setTextContent(inputField, '', platform);

        // Small delay to ensure clearing is processed
        await new Promise(resolve => setTimeout(resolve, 200));

        // Set the new content
        setTextContent(inputField, msg.prompt, platform);
        console.log('✅ Step 2: Text content set successfully');

        // Additional delay for Grok to process the input
        if (platform === 'Grok') {
          await new Promise(resolve => setTimeout(resolve, 300));
        }

        // Step 3: Wait for and find the send button
        console.log(`🧩 Step 3: Waiting for send button for ${platform}...`);
        const waitForSendButton = async (timeout = 5000) => {
          const selectors = getSendButtonSelectors(platform);

          for (const selector of selectors) {
            try {
              console.log(`Trying send button selector: ${selector}`);
              const btn = await waitForElement(selector, timeout / selectors.length);
              if (btn && (btn instanceof HTMLButtonElement || btn instanceof HTMLDivElement) && !btn.hasAttribute('disabled') && btn.getAttribute('aria-disabled') !== 'true') {
                console.log(`✅ Found enabled send button with selector: ${selector}`);
                return btn;
              } else {
                console.log(`Button found with ${selector} but is disabled or not a button`);
              }
            } catch (err) {
              console.log(`Send button not found with selector: ${selector}`);
            }
          }
          throw new Error(`No enabled send button found for ${platform} after trying all selectors`);
        };

        let sendButton: HTMLElement | undefined;
        try {
          sendButton = await waitForSendButton();
        } catch (err) {
          console.warn(`⚠️ Step 3: Send button not found for ${platform} within timeout, trying Enter key`);
          tryEnterKey(inputField, platform);
          console.log('✅ Step 3: Enter key pressed as fallback');
        }

        // Step 4: Click the send button if found
        if (sendButton) {
          console.log(`🧩 Step 4: Clicking send button for ${platform}...`);
          clickSendButton(sendButton, platform);
          console.log('✅ Step 4: Send button clicked');
        }

        // Step 5: Verify the message was sent
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log(`🧩 Step 5: Checking if message was sent for ${platform}...`);

        let currentText = '';
        if (inputField.tagName === 'TEXTAREA') {
          currentText = (inputField as HTMLTextAreaElement).value;
        } else {
          currentText = inputField.textContent || '';
        }

        if (currentText.trim() === '' || currentText.trim() !== msg.prompt.trim()) {
          console.log(`✅ Step 5: Message sent successfully for ${platform} (input cleared or changed)`);
          sendResponse({ success: true });
        } else {
          console.warn(`⚠️ Step 5: Input not cleared for ${platform}, send may have failed. Current text:`, currentText);
          sendResponse({ success: false, error: 'Message may not have been sent' });
        }

      } catch (err) {
        console.error(`❌ Error during prompt injection for ${platform}:`, (err instanceof Error ? err.message : String(err)));
        sendResponse({ success: false, error: err instanceof Error ? err.message : String(err) });
      }
    };

    injectAndSend();

    // Return true to indicate we will send a response asynchronously
    return true;
  });

  console.log('🧩 Content script message listener registered successfully');
}