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

// Listen for messages from the Chrome extension
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type !== 'INJECT_PROMPT') return;
  console.log('🧩 Received INJECT_PROMPT message with prompt:', msg.prompt);

  const injectAndSend = async () => {
    try {
      // Step 1: Wait for the composer form
      console.log('🧩 Step 1: Waiting for composer form...');
      console.log('✅ Step 1: Composer form found');

      // Step 2: Find the visible text input
      console.log('🧩 Step 2: Locating text input...');
      let inputField: HTMLElement | null = null;
      const inputSelectors = [
        '#prompt-textarea[contenteditable="true"]',
        'div[contenteditable="true"].ProseMirror',
        'textarea[data-testid="prompt-textarea"]:not([style*="display: none"])'
      ];
      for (const selector of inputSelectors) {
        try {
          console.log(`Trying selector: ${selector}`);
          inputField = await waitForElement(selector, 2000); // 2s timeout per selector
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

      // Step 3: Focus and clear the text input
      console.log('🧩 Step 3: Focusing and clearing text input...');
      inputField.focus();
      if (inputField.tagName === 'TEXTAREA') {
        const textarea = inputField as HTMLTextAreaElement;
        console.log('Current textarea value before clearing:', textarea.value);
        textarea.value = '';
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        console.log('Current contenteditable content before clearing:', inputField.textContent);
        inputField.textContent = '';
        inputField.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContent' }));
      }
      console.log('✅ Step 3: Text input cleared');

      // Step 4: Simulate typing the prompt
      console.log('🧩 Step 4: Simulating typing prompt:', msg.prompt);
      for (const char of msg.prompt) {
        if (inputField.tagName === 'TEXTAREA') {
          const textarea = inputField as HTMLTextAreaElement;
          textarea.value += char;
          textarea.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: char }));
          console.log(`Typed character into textarea: ${char}, new value: ${textarea.value}`);
        } else {
          const textNode = document.createTextNode(char);
          inputField.appendChild(textNode);
          inputField.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: char }));
          console.log(`Typed character into contenteditable: ${char}, new content: ${inputField.textContent}`);
        }
        await new Promise(resolve => setTimeout(resolve, 10)); // Small delay to mimic typing
      }
      inputField.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
      console.log('✅ Step 4: Prompt fully typed');

      // Step 5: Wait for and find the send button
      console.log('🧩 Step 5: Waiting for send button...');
      const waitForSendButton = async (timeout = 5000) => {
        const selectors = [
          'button[data-testid="send-button"]',
          '#composer-submit-button',
          'button[aria-label="Send prompt"]:not(:disabled)',
          'button[type="button"]:not(:disabled)'
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
        console.warn('⚠️ Step 5: Send button not found within timeout, falling back to Enter key');
        inputField.dispatchEvent(new KeyboardEvent('keydown', {
          bubbles: true,
          cancelable: true,
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13
        }));
        console.log('✅ Step 5: Enter key pressed as fallback');
      }

      // Step 6: Click the send button if found
      if (sendButton) {
        console.log('🧩 Step 6: Clicking send button...');
        sendButton.click();
        console.log('✅ Step 6: Send button clicked');
      }

      // Step 7: Check if the message was sent successfully
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s to allow UI update
      console.log('🧩 Step 7: Checking if message was sent...');
      let currentText = '';
      if (inputField.tagName === 'TEXTAREA') {
        currentText = (inputField as HTMLTextAreaElement).value;
      } else {
        currentText = inputField.textContent || '';
      }
      if (currentText.trim() === '') {
        console.log('✅ Step 7: Message sent successfully (input cleared)');
      } else {
        console.warn('⚠️ Step 7: Input not cleared, send may have failed. Current text:', currentText);
      }
    } catch (err) {
      console.error('❌ Error during prompt injection:', (err instanceof Error ? err.message : String(err)));
    }
  };

  injectAndSend();
});