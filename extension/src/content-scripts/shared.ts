console.log('🧩 ChatGPT-specific content script loaded on', location.href);

// Check if an element is visible on the page
const isVisible = (el: HTMLElement) => {
  const style = window.getComputedStyle(el);
  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0' &&
    el.offsetParent !== null
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

// Set text content naturally (all at once)
const setTextContent = (element: HTMLElement, text: string) => {
  if (element.tagName === 'TEXTAREA') {
    const textarea = element as HTMLTextAreaElement;
    textarea.value = text;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    // For contenteditable elements
    element.textContent = text;
    element.dispatchEvent(new InputEvent('input', { 
      bubbles: true, 
      inputType: 'insertText',
      data: text 
    }));
  }
};

// Listen for messages from the Chrome extension
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type !== 'INJECT_PROMPT') return;
  console.log('🧩 Received INJECT_PROMPT message with prompt:', msg.prompt);

  const injectAndSend = async () => {
    try {
      // Step 1: Find the visible text input
      console.log('🧩 Step 1: Locating text input...');
      let inputField: HTMLElement | null = null;
      const inputSelectors = [
        '#prompt-textarea[contenteditable="true"]',
        'div[contenteditable="true"].ProseMirror',
        'textarea[data-testid="prompt-textarea"]:not([style*="display: none"])',
        'textarea[placeholder*="Message"]',
        'div[contenteditable="true"][data-testid="prompt-textarea"]'
      ];
      
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
        throw new Error('No visible text input found after trying all selectors');
      }

      // Step 2: Focus and set the text content
      console.log('🧩 Step 2: Setting text content...');
      inputField.focus();
      
      // Clear existing content first
      setTextContent(inputField, '');
      
      // Small delay to ensure clearing is processed
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Set the new content
      setTextContent(inputField, msg.prompt);
      console.log('✅ Step 2: Text content set successfully');

      // Step 3: Wait for and find the send button
      console.log('🧩 Step 3: Waiting for send button...');
      const waitForSendButton = async (timeout = 5000) => {
        const selectors = [
          'button[data-testid="send-button"]',
          'button[aria-label="Send prompt"]',
          'button[type="submit"]',
          'button svg[data-testid="send-button"]',
          'button:has(svg[data-testid="send-button"])',
          'form button[type="button"]:not(:disabled)'
        ];
        
        for (const selector of selectors) {
          try {
            console.log(`Trying send button selector: ${selector}`);
            const btn = await waitForElement(selector, timeout / selectors.length);
            if (btn && btn instanceof HTMLButtonElement && !btn.disabled && !btn.hasAttribute('aria-disabled')) {
              console.log(`✅ Found enabled send button with selector: ${selector}`);
              return btn;
            } else {
              console.log(`Button found with ${selector} but is disabled or not a button`);
            }
          } catch (err) {
            console.log(`Send button not found with selector: ${selector}`);
          }
        }
        throw new Error('No enabled send button found after trying all selectors');
      };

      let sendButton: HTMLButtonElement | undefined;
      try {
        sendButton = await waitForSendButton();
      } catch (err) {
        console.warn('⚠️ Step 3: Send button not found within timeout, trying Enter key');
        
        // Try Enter key as fallback
        inputField.dispatchEvent(new KeyboardEvent('keydown', {
          bubbles: true,
          cancelable: true,
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13
        }));
        
        inputField.dispatchEvent(new KeyboardEvent('keyup', {
          bubbles: true,
          cancelable: true,
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13
        }));
        
        console.log('✅ Step 3: Enter key pressed as fallback');
      }

      // Step 4: Click the send button if found
      if (sendButton) {
        console.log('🧩 Step 4: Clicking send button...');
        sendButton.click();
        console.log('✅ Step 4: Send button clicked');
      }

      // Step 5: Verify the message was sent
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log('🧩 Step 5: Checking if message was sent...');
      
      let currentText = '';
      if (inputField.tagName === 'TEXTAREA') {
        currentText = (inputField as HTMLTextAreaElement).value;
      } else {
        currentText = inputField.textContent || '';
      }
      
      if (currentText.trim() === '') {
        console.log('✅ Step 5: Message sent successfully (input cleared)');
      } else {
        console.warn('⚠️ Step 5: Input not cleared, send may have failed. Current text:', currentText);
      }
      
    } catch (err) {
      console.error('❌ Error during prompt injection:', (err instanceof Error ? err.message : String(err)));
    }
  };

  injectAndSend();
});