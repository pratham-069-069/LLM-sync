// All DOM extraction and manipulation logic resides here.
// These functions are designed to be platform-agnostic where possible,
// but use platform-specific selectors when necessary.

/**
 * Detects the current AI chat platform based on the hostname.
 * @returns {string} The name of the platform (e.g., 'ChatGPT', 'Claude') or 'Unknown'.
 */
export const getPlatformName = (): string => {
  const hostname = location.hostname;

  if (hostname.includes('chatgpt.com')) return 'ChatGPT';
  if (hostname.includes('claude.ai')) return 'Claude';
  if (hostname.includes('deepseek.com')) return 'DeepSeek';
  if (hostname.includes('grok.com') || hostname.includes('x.com')) return 'Grok';
  if (hostname.includes('gemini.google.com') || hostname.includes('bard.google.com')) return 'Gemini';

  return 'Unknown';
};

/**
 * Checks if an element is currently visible on the page.
 * @param {HTMLElement} el The element to check.
 * @returns {boolean} True if the element is visible.
 */
export const isVisible = (el: HTMLElement) => {
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

/**
 * Waits for a specific element to appear and be visible in the DOM.
 * @param {string} selector The CSS selector for the element.
 * @param {number} timeout The maximum time to wait in milliseconds.
 * @returns {Promise<HTMLElement>} A promise that resolves with the found element.
 */
export const waitForElement = (selector: string, timeout = 10000) =>
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

/**
 * Sets the text content of an input field (textarea or contenteditable div)
 * using platform-specific methods to ensure React state updates are triggered.
 * @param {HTMLElement} element The input element.
 * @param {string} text The text to insert.
 * @param {string} platform The current AI platform.
 */
export const setTextContent = (element: HTMLElement, text: string, platform: string) => {
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
        // Clear existing content first
        element.textContent = '';
        element.focus();
        
        if (platform === 'Grok') {
            // For Grok, simulate typing to trigger React state updates
            element.textContent = text;
            
            // Trigger React-specific events
            element.dispatchEvent(new InputEvent('beforeinput', { 
                bubbles: true, 
                inputType: 'insertText', 
                data: text 
            }));
            element.dispatchEvent(new InputEvent('input', { 
                bubbles: true, 
                inputType: 'insertText', 
                data: text 
            }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
            
            // Additional React triggers
            element.dispatchEvent(new KeyboardEvent('keydown', { 
                bubbles: true, 
                key: 'End', 
                code: 'End' 
            }));
            element.dispatchEvent(new KeyboardEvent('keyup', { 
                bubbles: true, 
                key: 'End', 
                code: 'End' 
            }));
        } else {
            element.textContent = text;
            element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
        }
    } else {
        element.textContent = text;
        element.dispatchEvent(new Event('input', { bubbles: true }));
    }

    element.dispatchEvent(new Event('keyup', { bubbles: true }));
};

/**
 * Gets an array of CSS selectors for the main text input field for a given platform.
 * @param {string} platform The current AI platform.
 * @returns {string[]} An array of selectors to try.
 */
export const getInputSelectors = (platform: string): string[] => {
    switch (platform) {
        case 'ChatGPT':
            return ['#prompt-textarea'];
        case 'Claude':
            return ['div[contenteditable="true"].ProseMirror'];
        case 'DeepSeek':
            return ['textarea[id="chat-input"]', 'textarea[placeholder="Message DeepSeek"]'];
        case 'Grok':
            return [
                // Updated selectors based on the DOM structure
                'div[contenteditable="true"][data-testid="grok-composer-input"]',
                'div[contenteditable="true"][aria-label*="Ask Grok"]',
                'div[contenteditable="true"][role="textbox"]',
                'div[contenteditable="true"].notranslate',
                'div[contenteditable="true"][style*="white-space: pre-wrap"]',
                // Fallback selectors
                'textarea[data-grok-form-interact-field="prompt"]',
                'textarea[aria-label="Ask Grok anything"]',
                'form textarea:not([style*="display: none"])'
            ];
        case 'Gemini':
            return ['div.ql-editor[contenteditable="true"]'];
        default:
            return ['textarea', 'div[contenteditable="true"]'];
    }
};

/**
 * Gets an array of CSS selectors for the send button for a given platform.
 * @param {string} platform The current AI platform.
 * @returns {string[]} An array of selectors to try.
 */
export const getSendButtonSelectors = (platform: string): string[] => {
    switch (platform) {
        case 'ChatGPT': return ['button[data-testid="send-button"]'];
        case 'Claude': return ['button[aria-label="Send Message"]'];
        case 'DeepSeek': return ['div[role="button"][aria-disabled="false"]'];
        case 'Grok':
            return [
                // Updated selectors for Grok send button
                'button[data-testid="grok-send-button"]',
                'button[aria-label="Send message"]',
                'button[aria-label="Send"]',
                'button[type="submit"]:not(:disabled)',
                'div[role="button"][data-testid*="send"]',
                // Look for buttons near the input area
                'form button[type="submit"]:not(:disabled)',
                'button[aria-label="Submit"][type="submit"]'
            ];
        case 'Gemini': return ['button.send-arrow-button', 'button[aria-label="Send message"]'];
        default: return ['button[type="submit"]'];
    }
};

/**
 * Gets an array of CSS selectors for the AI's response containers for a given platform.
 * @param {string} platform The current AI platform.
 * @returns {string[]} An array of selectors to try.
 */
export const getResponseSelectors = (platform: string): string[] => {
    switch (platform) {
      case 'ChatGPT': 
        return ['div[data-message-author-role="assistant"] .prose'];
      case 'Claude': 
        return [
          // Updated from DOM screenshot analysis
          '.font-claude-response',
          '.standard-markdown',
          '.whitespace-normal.break-words',
          '.grid-cols-1.grid',
          '[class*="standard-markdown"]',
          'p[class*="whitespace-normal"]',
          // Keep some original fallbacks
          'div.font-claude-message',
          'div[data-message-author-role="assistant"]',
          '.prose',
          '.contents',
          '.claude-answer',
          '.message-content[data-message-side="received"]',
          '.message-thread__message--ai'
        ];
      case 'Gemini': 
        return [
          // Updated from DOM screenshot analysis
          '.response-content',
          '.model-response-text',
          '.markdown.markdown-main-panel',
          'message-content',
          '.markdown-main-panel',
          '.ng-star-inserted',
          // Keep some original fallbacks
          '.model-response-text .markdown',
          '[data-model-response]',
          '[data-testid*="response"]',
          '[role="region"]',
          '.gemini-response-content',
          '.response-container',
          '.bard-response'
        ];
      case 'DeepSeek': 
        return [
          // Updated from DOM screenshot analysis
          '[class*="ds-message"]',
          '.ds-markdown',
          '.ds-markdown-paragraph',
          '[class*="ds-markdown"]',
          // Keep original selectors as fallbacks
          'div.ds-markdown.ds-markdown-block',     // Main container for complete response
          'div.ds-markdown-block',                 // Alternative container
          'div[class*="ds-markdown-block"]',       // Fallback with partial match
          '.chat-message-item[data-role="assistant"]',
          '.message-content',
          '.deepseek-response',
          '.ai-message-container',
          '.ai-response-content'
        ];
      case 'Grok': 
        return [
          // Based on your DOM screenshot - target the actual content
          'div[class*="break-words"] p[dir="auto"]',
          'div[class*="prose"] p[dir="auto"]',
          'p[dir="auto"][style*="white-space: pre-wrap"]',
          'div[class*="message-bubble"] p',
          'div[class*="response-content"] p',
          // Broader fallbacks
          'div[class*="break-words"] p',
          'div[dir="auto"] p',
          'p[style*="white-space: pre-wrap"]'
        ];
      default: 
        return [
          '.assistant-response', 
          '.model-output',
          '[data-role="assistant"]',
          '.assistant-message',
          '.ai-message'
        ];
    }
};

/**
 * Gets the CSS selector for the container around the main text input for a given platform.
 * This is where the Enhance button will be injected.
 * @param {string} platform The current AI platform.
 * @returns {string} The CSS selector for the prompt container.
 */
export const getPromptContainerSelector = (platform: string): string => {
    switch (platform) {
        case 'ChatGPT':
            return 'div:has(> #prompt-textarea)';
        case 'Claude':
            return 'div:has(> .ProseMirror)';
        case 'Grok':
            return 'div.query-bar.group';
        default:
            return 'div:has(> textarea)';
    }
};

/**
 * Gets the CSS selector for the main chat container for a given platform.
 * This is used to observe for new messages.
 * @param {string} platform The current AI platform.
 * @returns {string} The CSS selector for the chat container.
 */
export const getChatContainerSelector = (platform: string): string => {
    switch(platform) {
        case 'ChatGPT': return 'div[class*="react-scroll-to-bottom"]';
        case 'Claude': return '[data-testid="conversation-container"]';
        case 'Gemini': return '.chat-history';
        case 'DeepSeek': return '.chat-container';
        case 'Grok': return 'main, div[class*="flex"][class*="flex-col"], div[class*="relative"], body';
        default: return 'main';
    }
};

/**
 * Clicks the send button using platform-specific methods.
 * @param {HTMLElement} button The send button element.
 * @param {string} platform The current AI platform.
 */
export const clickSendButton = (button: HTMLElement, platform: string) => {
    console.log(`🔧 Clicking send button for ${platform}`);

    if (platform === 'Grok') {
        // Enhanced Grok button clicking
        button.focus();
        
        // Simulate full mouse interaction sequence
        button.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, cancelable: true }));
        button.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true }));
        button.dispatchEvent(new MouseEvent('mousedown', { 
            bubbles: true, 
            cancelable: true,
            button: 0,
            buttons: 1
        }));
        
        setTimeout(() => {
            button.dispatchEvent(new MouseEvent('mouseup', { 
                bubbles: true, 
                cancelable: true,
                button: 0,
                buttons: 0
            }));
            button.dispatchEvent(new MouseEvent('click', { 
                bubbles: true, 
                cancelable: true,
                button: 0,
                buttons: 0
            }));
            
            // Additional React event triggers
            button.dispatchEvent(new Event('submit', { bubbles: true }));
        }, 50);
    } else {
        button.click();
    }
};

/**
 * Simulates pressing the Enter key in the input field as a fallback if no send button is found.
 * @param {HTMLElement} inputField The input field element.
 * @param {string} platform The current AI platform.
 */
export const tryEnterKey = (inputField: HTMLElement, platform: string) => {
    console.log(`🔧 Trying Enter key for ${platform}`);
    
    if (platform === 'Grok') {
        // Try multiple key combinations for Grok
        const keyEvents = [
            { key: 'Enter', code: 'Enter', keyCode: 13, which: 13 },
            { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, ctrlKey: true },
            { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, shiftKey: false }
        ];
        
        keyEvents.forEach(eventProps => {
            inputField.dispatchEvent(new KeyboardEvent('keydown', { 
                bubbles: true, 
                cancelable: true, 
                ...eventProps 
            }));
            inputField.dispatchEvent(new KeyboardEvent('keypress', { 
                bubbles: true, 
                cancelable: true, 
                ...eventProps 
            }));
            inputField.dispatchEvent(new KeyboardEvent('keyup', { 
                bubbles: true, 
                cancelable: true, 
                ...eventProps 
            }));
        });
    } else {
        const enterEvent = new KeyboardEvent('keydown', { 
            bubbles: true, 
            cancelable: true, 
            key: 'Enter', 
            code: 'Enter', 
            keyCode: 13, 
            which: 13 
        });
        inputField.dispatchEvent(enterEvent);
    }
};

/**
 * Reads the latest response from the AI, handling complex DOM structures for specific platforms.
 * @param {string} platform The current AI platform.
 * @returns {Promise<string>} A promise that resolves with the full text of the latest response.
 */
export const readLatestResponse = async (platform: string): Promise<string> => {
    console.log(`📖 Reading latest response from ${platform}...`);
    
    if (platform === 'DeepSeek') {
        // Method 1: Try to find the complete response container first
        const containers = document.querySelectorAll<HTMLElement>('div.ds-markdown.ds-markdown-block');
        
        if (containers && containers.length > 0) {
            const latestContainer = containers[containers.length - 1];
            console.log(`✅ Found ${containers.length} DeepSeek response containers, using the latest one`);
            
            const responseText = latestContainer.textContent?.trim();
            if (responseText) {
                console.log(`✅ DeepSeek complete response from container: "${responseText.substring(0, 100)}..."`);
                return responseText;
            }
        }
        
        // Method 2: If containers don't work, group paragraphs by their parent message
        console.log('⚠️ Fallback: Trying to group paragraphs by message...');
        const allParagraphs = document.querySelectorAll<HTMLElement>('.ds-markdown-paragraph');
        
        if (!allParagraphs || allParagraphs.length === 0) {
            throw new Error('No response paragraphs found for DeepSeek');
        }
        
        // Find the last group of consecutive paragraphs (they belong to the same message)
        // We'll work backwards from the last paragraph
        const lastParagraph = allParagraphs[allParagraphs.length - 1];
        const messageContainer = lastParagraph.closest('div[class*="4f9bf79"]') || lastParagraph.closest('div[class*="message"]');
        
        if (messageContainer) {
            // Get all paragraphs within this message container
            const messageParagraphs = messageContainer.querySelectorAll<HTMLElement>('.ds-markdown-paragraph');
            const fullResponse = Array.from(messageParagraphs)
                .map(p => p.textContent?.trim())
                .filter(text => text && text.length > 0)
                .join('\n\n');
            
            if (fullResponse) {
                console.log(`✅ DeepSeek response from ${messageParagraphs.length} grouped paragraphs: "${fullResponse.substring(0, 100)}..."`);
                return fullResponse;
            }
        }
        
        // Method 3: Last resort - try to detect message boundaries by DOM structure
        console.log('⚠️ Last resort: Analyzing DOM structure for message boundaries...');
        const paragraphsArray = Array.from(allParagraphs);
        
        // Take the last few paragraphs and check if they're part of the same message
        // by looking for common parent patterns
        let currentMessageParagraphs: HTMLElement[] = [];
        let currentParent: Element | null = null;
        
        // Work backwards to find paragraphs belonging to the same message
        for (let i = paragraphsArray.length - 1; i >= 0; i--) {
            const para = paragraphsArray[i];
            const paraParent = para.closest('div[class*="4f9bf79"]') || para.closest('div[class*="ds-markdown"]');
            
            if (currentParent === null) {
                currentParent = paraParent;
                currentMessageParagraphs.unshift(para);
            } else if (paraParent === currentParent) {
                currentMessageParagraphs.unshift(para);
            } else {
                // Different parent - we've found the boundary
                break;
            }
        }
        
        if (currentMessageParagraphs.length > 0) {
            const fullResponse = currentMessageParagraphs
                .map(p => p.textContent?.trim())
                .filter(text => text && text.length > 0)
                .join('\n\n');
            
            console.log(`✅ DeepSeek response from ${currentMessageParagraphs.length} boundary-detected paragraphs: "${fullResponse.substring(0, 100)}..."`);
            return fullResponse;
        }
        
        throw new Error('Could not extract complete DeepSeek response using any method');
        
    } else if (platform === 'Grok') {
        // Enhanced Grok response reading
        const selectors = getResponseSelectors(platform);
        let responseElements: NodeListOf<HTMLElement> | null = null;

        for (const selector of selectors) {
            responseElements = document.querySelectorAll<HTMLElement>(selector);
            console.log(`🔍 Trying Grok selector: ${selector}, found ${responseElements.length} elements`);
            if (responseElements && responseElements.length > 0) {
                console.log(`✅ Found ${responseElements.length} response elements with selector: ${selector}`);
                break;
            }
        }
        
        if (!responseElements || responseElements.length === 0) {
            // Fallback: try to find any message-like content
            console.log('⚠️ Grok fallback: looking for any message content...');
            const fallbackSelectors = [
                'div[class*="break-words"] p',
                'div[class*="prose"] div',
                'div[dir="auto"] p'
            ];
            
            for (const fallbackSelector of fallbackSelectors) {
                responseElements = document.querySelectorAll<HTMLElement>(fallbackSelector);
                if (responseElements && responseElements.length > 0) {
                    console.log(`✅ Found ${responseElements.length} response elements with fallback selector: ${fallbackSelector}`);
                    break;
                }
            }
        }
        
        if (!responseElements || responseElements.length === 0) {
            throw new Error(`No response elements found for ${platform}`);
        }
        
        // For Grok, try to get the complete message by grouping related elements
        const latestResponseElement = responseElements[responseElements.length - 1];
        
        // Try to find the parent message container
        const messageContainer = latestResponseElement.closest('div[class*="message-bubble"]') || 
                               latestResponseElement.closest('div[data-testid*="grok"]') ||
                               latestResponseElement.closest('div[dir="auto"]');
        
        let responseText = '';
        
        if (messageContainer) {
            // Get all text content from the message container
            const textElements = messageContainer.querySelectorAll('p, div[class*="break-words"]');
            responseText = Array.from(textElements)
                .map(el => el.textContent?.trim())
                .filter(text => text && text.length > 0)
                .join('\n\n');
        }
        
        if (!responseText) {
            responseText = latestResponseElement.textContent?.trim() || '';
        }
        
        if (!responseText) {
            throw new Error('Could not extract text from the latest Grok response element.');
        }

        console.log(`✅ Extracted Grok response: "${responseText.substring(0, 100)}..."`);
        return responseText;
        
    } else {
        // Original logic for other platforms
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
        
        const latestResponseElement = responseElements[responseElements.length - 1];
        if (!latestResponseElement || !latestResponseElement.textContent) {
            throw new Error('Could not extract text from the latest response element.');
        }

        console.log(`✅ Extracted response: "${latestResponseElement.textContent.substring(0, 100)}..."`);
        return latestResponseElement.textContent.trim();
    }
};

/**
 * Waits for an AI response to finish generating by observing the DOM for a period of inactivity.
 * @param {string} platform The current AI platform.
 * @param {string} responseContainerSelector The selector for the container to observe.
 * @returns {Promise<void>} A promise that resolves when the response is likely complete.
 */
export const waitForResponseCompletion = (platform: string, responseContainerSelector: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        if (platform === 'Grok') {
            // For Grok, use a different strategy - wait for new content to appear
            console.log(`👀 Grok: Waiting for response to appear...`);
            
            let attempts = 0;
            const maxAttempts = 30; // 30 seconds max
            const checkInterval = 1000; // Check every second
            
            const checkForResponse = () => {
                attempts++;
                
                // Look for response content
                const responseElements = document.querySelectorAll('div[class*="break-words"] p[dir="auto"], p[dir="auto"][style*="white-space: pre-wrap"]');
                
                if (responseElements.length > 0) {
                    const latestResponse = responseElements[responseElements.length - 1];
                    const responseText = latestResponse.textContent?.trim();
                    
                    if (responseText && responseText.length > 10) {
                        console.log(`✅ Grok response detected: "${responseText.substring(0, 50)}..."`);
                        
                        // Wait a bit more for the response to complete
                        setTimeout(() => {
                            console.log(`✅ Grok response completion wait finished.`);
                            resolve();
                        }, 3000);
                        return;
                    }
                }
                
                if (attempts >= maxAttempts) {
                    console.warn(`⚠️ Grok: Max attempts reached (${maxAttempts}), proceeding anyway...`);
                    resolve();
                    return;
                }
                
                console.log(`🔍 Grok: Checking for response... (attempt ${attempts}/${maxAttempts})`);
                setTimeout(checkForResponse, checkInterval);
            };
            
            // Start checking after a brief delay
            setTimeout(checkForResponse, 2000);
            
        } else {
            // Original logic for other platforms
            let debounceTimer: number;
            const DEBOUNCE_DELAY = 2000;

            const observer = new MutationObserver(() => {
                clearTimeout(debounceTimer);
                debounceTimer = window.setTimeout(() => {
                    console.log(`✅ Response on ${platform} appears to be complete.`);
                    observer.disconnect();
                    resolve();
                }, DEBOUNCE_DELAY);
            });

            const chatContainer = document.querySelector(responseContainerSelector);
            if (!chatContainer) {
                console.warn(`Could not find chat container for ${platform}. Falling back to a fixed wait.`);
                setTimeout(() => resolve(), 10000);
                return;
            }

            console.log(`👀 Watching for response completion on ${platform}...`);
            observer.observe(chatContainer, {
                childList: true,
                subtree: true,
                characterData: true
            });

            debounceTimer = window.setTimeout(() => {
                console.log(`✅ Initial response on ${platform} complete.`);
                observer.disconnect();
                resolve();
            }, DEBOUNCE_DELAY);

            setTimeout(() => {
                observer.disconnect();
                reject(new Error('Response completion timed out after 60 seconds.'));
            }, 60000);
        }
    });
};

// --- HIGHLIGHTING UTILITIES ---

/**
 * Applies a highlight to a text selection while preserving HTML structure.
 * Uses TreeWalker to iterate through text nodes and highlight each individually.
 * 
 * @param range The selection range to highlight
 * @param color The highlight color to apply
 * @param id Unique identifier for this highlight
 * @returns boolean indicating if highlighting was successful
 */
export const createHighlight = async (range: Range, color: string, id: string): Promise<boolean> => {
  // Don't proceed with empty selections
  if (!range || !range.toString().trim()) return false;

  console.log(`Creating highlight with color: ${color}, id: ${id}`);
  
  // Check the platform
  const platform = getPlatformName();
  console.log(`Current platform: ${platform}`);
  
  // Use specialized approach for Angular-based platforms
  if (platform === 'Gemini' || platform === 'DeepSeek') {
    console.log('Using Angular-compatible highlighting approach');
    return await createHighlightForAngularApps(range, color, id);
  }
  
  console.log('Using standard highlighting approach');
  
  // For other platforms, use the original approach
  // First try the simple approach for basic selections
  if (isSafeForSurroundContents(range)) {
    try {
      const span = document.createElement('span');
      span.id = id;
      span.className = `nexusmind-highlight nexusmind-highlight-${color}`;
      span.dataset.color = color;
      range.surroundContents(span);
      console.log('Simple highlighting successful');
      return true;
    } catch (e) {
      console.log('Simple highlighting failed, trying TreeWalker approach');
      // Continue to TreeWalker approach
    }
  }
  
  // For complex selections, use TreeWalker to preserve HTML structure
  const result = highlightWithTreeWalker(range, color, id);
  console.log(`TreeWalker highlighting result: ${result}`);
  return result;
};/**
 * Checks if a range is suitable for the simple surroundContents approach.
 * This is only safe when the selection is entirely within a single text node.
 */
export const isSafeForSurroundContents = (range: Range): boolean => {
    try {
        return (
            range.startContainer.nodeType === Node.TEXT_NODE &&
            range.endContainer.nodeType === Node.TEXT_NODE &&
            range.startContainer === range.endContainer
        );
    } catch {
        return false;
    }
};

/**
 * Uses TreeWalker to highlight text nodes within a selection,
 * preserving the original HTML structure.
 */
export const highlightWithTreeWalker = (range: Range, color: string, id: string): boolean => {
  try {
    // Clone the range contents to a document fragment
    const fragment = range.cloneContents();
    if (!fragment.textContent) return false;
    
    // Create a highlight class to apply
    const highlightClass = `nexusmind-highlight nexusmind-highlight-${color}`;
    
    // Track if we've modified any nodes
    let modified = false;
    
    // Process text nodes within the selection with TreeWalker
    const walker = document.createTreeWalker(
      fragment,
      NodeFilter.SHOW_TEXT,
      null
    );
    
    // Collect text nodes to process
    const textNodes: Text[] = [];
    let currentNode: Text | null;
    
    while ((currentNode = walker.nextNode() as Text)) {
      if (currentNode.textContent && currentNode.textContent.trim()) {
        textNodes.push(currentNode);
      }
    }
    
    // Process each text node
    textNodes.forEach(textNode => {
      if (textNode.textContent && textNode.textContent.trim()) {
        const span = document.createElement('span');
        span.className = highlightClass;
        span.dataset.highlightId = id;
        span.dataset.color = color;
        
        // Replace text node with our highlighted span
        const parent = textNode.parentNode;
        if (parent) {
          const wrapper = span.cloneNode() as HTMLSpanElement;
          parent.replaceChild(wrapper, textNode);
          wrapper.appendChild(textNode);
          modified = true;
        }
      }
    });
    
    // If we made changes, replace the range content with our modified fragment
    if (modified) {
      range.deleteContents();
      range.insertNode(fragment);
      return true;
    }
    
    return false;
  } catch (e) {
    console.error('Error in TreeWalker highlighting:', e);
    return false;
  }
};
/**
 * Gets the virtual scroll top value from a container that uses CSS transform for scrolling.
 * @param {HTMLElement} scrollElement The container element (e.g., infinite-scroller).
 * @returns {number} The vertical scroll offset.
 */
const getVirtualScrollTop = (scrollElement: HTMLElement): number => {
  // Find the direct child div that is being transformed.
  const transformedContent = scrollElement.querySelector<HTMLElement>(':scope > div');
  
  if (!transformedContent) {
    // If no transformed child is found, fall back to the regular scrollTop.
    return scrollElement.scrollTop;
  }

  const transformStyle = window.getComputedStyle(transformedContent).transform;

  // The transform style will be 'matrix(1, 0, 0, 1, 0, -3077.6)' or 'none'.
  // We need to extract the last number, which is the translateY value.
  if (transformStyle && transformStyle !== 'none') {
    try {
      // Use a regular expression to parse the matrix and get the 'e' (tx) and 'f' (ty) values
      const matrixValues = transformStyle.match(/matrix.*\((.+)\)/);
      if (matrixValues && matrixValues[1]) {
        const parts = matrixValues[1].split(', ');
        // The vertical translation (translateY) is the last part of the matrix.
        const translateY = parseFloat(parts[5]);
        // The value is negative when scrolling down, so we return its absolute value.
        return Math.abs(translateY);
      }
    } catch (e) {
      console.error("Could not parse transform style:", transformStyle, e);
      return scrollElement.scrollTop; // Fallback on error
    }
  }

  return scrollElement.scrollTop; // Fallback if no transform
};

/**
 * Platform-specific highlight implementation for Gemini and DeepSeek.
 * This version positions highlights relative to the app's internal scroll container.
 * @param range The selection range to highlight
 * @param color The highlight color
 * @param id The unique highlight ID
 * @returns boolean Success status
 */
export const createHighlightForAngularApps = async (range: Range, color: string, id: string): Promise<boolean> => {
  try {
    const platform = getPlatformName();
    console.log(`Creating Angular-compatible highlight for ${platform}`);

    const positioningContainer = await getScrollContainerForPlatform(platform);
    const scrollElement = positioningContainer.querySelector('infinite-scroller') || positioningContainer;
    console.log("Using element for positioning:", positioningContainer);
    console.log("Using element for scroll values:", scrollElement);

    ensureHighlightStylesExist();
    const containerId = 'nexusmind-highlights-container';
    let highlightsContainer = positioningContainer.querySelector<HTMLElement>('#' + containerId);

    if (!highlightsContainer) {
      if (window.getComputedStyle(positioningContainer).position === 'static') {
        positioningContainer.style.position = 'relative';
      }
      highlightsContainer = document.createElement('div');
      highlightsContainer.id = containerId;
      highlightsContainer.style.position = 'absolute';
      highlightsContainer.style.top = '0';
      highlightsContainer.style.left = '0';
      highlightsContainer.style.pointerEvents = 'none';
      highlightsContainer.style.zIndex = '9999';

      highlightsContainer.style.width = `${scrollElement.scrollWidth}px`;
      highlightsContainer.style.height = `${scrollElement.scrollHeight}px`;

      positioningContainer.appendChild(highlightsContainer);
      console.log('Created absolute-position highlights container inside', positioningContainer);
    }

    const rangeRects = range.getClientRects();
    if (!rangeRects || rangeRects.length === 0) {
      console.warn('No range rects found for selection');
      return false;
    }

    const containerRect = positioningContainer.getBoundingClientRect();

    // --- CHANGE: Use our new function to get the true scroll position ---
    const scrollTop = getVirtualScrollTop(scrollElement as HTMLElement);
    // For horizontal scrolling, scrollLeft is usually reliable, but we'll keep it simple.
    const scrollLeft = scrollElement.scrollLeft;

    console.log(`Creating ${rangeRects.length} highlight parts with VIRTUAL scrollTop: ${scrollTop}`);

    for (let i = 0; i < rangeRects.length; i++) {
      const rect = rangeRects[i];
      if (rect.width < 3 || rect.height < 3) continue;

      const overlay = document.createElement('div');
      overlay.id = `${id}-part-${i}`;
      overlay.className = `nexusmind-highlight-overlay nexusmind-highlight-${color}`;
      overlay.dataset.highlightId = id;

      overlay.style.position = 'absolute';
      const top = rect.top - containerRect.top + scrollTop;
      const left = rect.left - containerRect.left + scrollLeft;

      overlay.style.top = `${top}px`;
      overlay.style.left = `${left}px`;
      overlay.style.width = `${rect.width}px`;
      overlay.style.height = `${rect.height}px`;

      highlightsContainer.appendChild(overlay);
      console.log(`Created highlight part ${i} at (top: ${top.toFixed(2)}, left: ${left.toFixed(2)})`);
    }

    const highlightData = { id, color, text: range.toString(), timestamp: Date.now() };
    document.body.setAttribute(`data-nexusmind-highlight-${id}`, JSON.stringify(highlightData));

    console.log(`Highlight created successfully with ${rangeRects.length} parts`);
    return true;

  } catch (e) {
    console.error('Error creating highlight overlay:', e);
    return false;
  }
};

/**
 * Asynchronously finds the specific scrollable container element for platforms that use one.
 * @param {string} platform The current AI platform.
 * @returns {Promise<HTMLElement>} A promise that resolves with the scrollable container or the document body as a fallback.
 */
const getScrollContainerForPlatform = async (platform: string): Promise<HTMLElement> => {
  let selector = '';
  if (platform === 'Gemini') {
    selector = '.chat-history-scroll-container';
  } else if (platform === 'DeepSeek') {
    selector = '[class*="ds-scroll-area"]';
  }

  if (selector) {
    try {
      // Wait for the element to exist and be visible, with a 5-second timeout.
      const container = await waitForElement(selector, 5000);
      console.log(`✅ Found scroll container for ${platform}:`, container);
      return container;
    } catch (error) {
      console.warn(`⚠️ Could not find scroll container with selector "${selector}" within timeout. Falling back to document.body.`);
      return document.body;
    }
  }

  console.warn(`⚠️ No specific scroll container selector for ${platform}. Falling back to document.body.`);
  return document.body;
};

/**
 * Ensures highlight styles exist in the document
 */
const ensureHighlightStylesExist = () => {
  const styleId = 'nexusmind-highlight-styles';
  if (document.getElementById(styleId)) return;
  
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    .nexusmind-highlight-yellow { background-color: rgba(255, 255, 0, 0.3); }
    .nexusmind-highlight-blue { background-color: rgba(0, 0, 255, 0.2); }
    .nexusmind-highlight-green { background-color: rgba(0, 255, 0, 0.2); }
    .nexusmind-highlight-pink { background-color: rgba(255, 105, 180, 0.2); }
    .nexusmind-highlight-purple { background-color: rgba(128, 0, 128, 0.2); }
    .nexusmind-highlight-red { background-color: rgba(255, 0, 0, 0.2); }
    .nexusmind-highlight-overlay {
      border-radius: 2px;
      mix-blend-mode: multiply;
      pointer-events: none !important;
      position: absolute !important;
      z-index: 9999 !important;
      box-shadow: 0 0 0 1px rgba(0,0,0,0.05);
    }
  `;
  document.head.appendChild(style);
  console.log('✅ NexusMind highlight styles added to document');
};

// --- PART 1: ADVANCED HIGHLIGHT CREATION ---

/**
 * Advanced highlight selection function that handles complex selections without breaking DOM
 * @param color The highlight color to apply
 * @returns Promise<boolean> Success status
 */
export const highlightSelection = async (color: string): Promise<boolean> => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    console.warn('No selection found');
    return false;
  }

  const range = selection.getRangeAt(0);
  const selectedText = range.toString().trim();
  
  if (!selectedText) {
    console.warn('Empty selection');
    return false;
  }

  console.log(`Creating advanced highlight with color: ${color}`);
  
  try {
    // Generate unique ID for this highlight
    const highlightId = `nexus-highlight-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Serialize the range for storage
    const serializedRange = serializeRange(range);
    
    // Get conversation details (URL and chat ID)
    const conversationDetails = getConversationDetails();
    
    // Create highlight using advanced node iteration
    const success = await createAdvancedHighlight(range, color, highlightId);
    
    if (success) {
      // Send to background script for storage
      chrome.runtime.sendMessage({
        type: 'SAVE_HIGHLIGHT',
        highlight: {
          id: highlightId,
          text: selectedText,
          color: color,
          url: conversationDetails.url,
          chatId: conversationDetails.chatId,
          platform: getPlatformName(),
          serializedRange: serializedRange,
          timestamp: Date.now()
        }
      });
      
      // Clear selection
      selection.removeAllRanges();
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error in highlightSelection:', error);
    return false;
  }
};

/**
 * Creates highlight by iterating through text nodes without using surroundContents
 * @param range The selection range
 * @param color The highlight color
 * @param highlightId Unique identifier
 * @returns Promise<boolean> Success status
 */
const createAdvancedHighlight = async (range: Range, color: string, highlightId: string): Promise<boolean> => {
  try {
    // Get all text nodes within the range
    const textNodes = getTextNodesInRange(range);
    
    if (textNodes.length === 0) {
      console.warn('No text nodes found in range');
      return false;
    }

    console.log(`Processing ${textNodes.length} text nodes for highlighting`);
    
    // Process each text node
    for (const nodeInfo of textNodes) {
      const { node, startOffset, endOffset } = nodeInfo;
      
      // Create highlight element
      const highlight = document.createElement('nexus-highlight');
      highlight.style.cssText = `background-color: ${getCssColorForHighlight(color)}; border-radius: 2px;`;
      highlight.dataset.highlightId = highlightId;
      highlight.dataset.color = color;
      
      // Split the text node and wrap the selected portion
      if (startOffset === 0 && endOffset === node.textContent!.length) {
        // Wrap entire text node
        const parent = node.parentNode!;
        parent.insertBefore(highlight, node);
        highlight.appendChild(node);
      } else {
        // Split text node and wrap middle portion
        const parent = node.parentNode!;
        const beforeText = node.textContent!.substring(0, startOffset);
        const highlightText = node.textContent!.substring(startOffset, endOffset);
        const afterText = node.textContent!.substring(endOffset);
        
        // Create new text nodes
        if (beforeText) {
          const beforeNode = document.createTextNode(beforeText);
          parent.insertBefore(beforeNode, node);
        }
        
        highlight.textContent = highlightText;
        parent.insertBefore(highlight, node);
        
        if (afterText) {
          const afterNode = document.createTextNode(afterText);
          parent.insertBefore(afterNode, node);
        }
        
        // Remove original node
        parent.removeChild(node);
      }
    }
    
    console.log(`Successfully created highlight with ${textNodes.length} parts`);
    return true;
    
  } catch (error) {
    console.error('Error in createAdvancedHighlight:', error);
    return false;
  }
};

/**
 * Gets all text nodes within a range with their relative offsets
 * @param range The selection range
 * @returns Array of text nodes with offset information
 */
const getTextNodesInRange = (range: Range): Array<{node: Text, startOffset: number, endOffset: number}> => {
  const textNodes: Array<{node: Text, startOffset: number, endOffset: number}> = [];
  
  // Create tree walker to find text nodes
  const walker = document.createTreeWalker(
    range.commonAncestorContainer,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: (node) => {
        if (range.intersectsNode(node)) {
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_REJECT;
      }
    }
  );
  
  let currentNode: Text | null;
  while ((currentNode = walker.nextNode() as Text)) {
    if (currentNode.textContent) {
      let startOffset = 0;
      let endOffset = currentNode.textContent.length;
      
      // Calculate precise offsets for this text node
      if (currentNode === range.startContainer) {
        startOffset = range.startOffset;
      }
      if (currentNode === range.endContainer) {
        endOffset = range.endOffset;
      }
      
      // Only include if there's actual text to highlight
      if (startOffset < endOffset) {
        textNodes.push({
          node: currentNode,
          startOffset,
          endOffset
        });
      }
    }
  }
  
  return textNodes;
};

/**
 * Gets CSS color value for highlight color name
 * @param color Color name
 * @returns CSS color value
 */
const getCssColorForHighlight = (color: string): string => {
  const colors: Record<string, string> = {
    yellow: 'rgba(255, 255, 0, 0.3)',
    green: 'rgba(0, 255, 0, 0.3)',
    blue: 'rgba(0, 123, 255, 0.3)',
    red: 'rgba(255, 0, 0, 0.3)',
    purple: 'rgba(128, 0, 128, 0.3)'
  };
  return colors[color] || colors.yellow;
};

// --- PART 2: RANGE SERIALIZATION ---

/**
 * Serializes a Range object to XPath-based coordinates for storage
 * @param range The Range to serialize
 * @returns Serialized range data
 */
export const serializeRange = (range: Range): {
  startPath: string;
  startOffset: number;
  endPath: string;
  endOffset: number;
} => {
  return {
    startPath: getXPathForNode(range.startContainer),
    startOffset: range.startOffset,
    endPath: getXPathForNode(range.endContainer),
    endOffset: range.endOffset
  };
};

/**
 * Generates XPath for a DOM node
 * @param node The node to generate XPath for
 * @returns XPath string
 */
const getXPathForNode = (node: Node): string => {
  const parts: string[] = [];
  let currentNode: Node | null = node;
  
  while (currentNode && currentNode.nodeType !== Node.DOCUMENT_NODE) {
    let index = 0;
    let sibling = currentNode.previousSibling;
    
    while (sibling) {
      if (sibling.nodeType === currentNode.nodeType && sibling.nodeName === currentNode.nodeName) {
        index++;
      }
      sibling = sibling.previousSibling;
    }
    
    const tagName = currentNode.nodeType === Node.TEXT_NODE ? 'text()' : currentNode.nodeName.toLowerCase();
    const part = index > 0 ? `${tagName}[${index + 1}]` : tagName;
    parts.unshift(part);
    
    currentNode = currentNode.parentNode;
  }
  
  return '/' + parts.join('/');
};

// --- PART 3: HIGHLIGHT RESTORATION ---

/**
 * Deserializes XPath-based range data back to a Range object
 * @param serializedRange The serialized range data
 * @returns Range object or null if deserialization fails
 */
export const deserializeRange = (serializedRange: {
  startPath: string;
  startOffset: number;
  endPath: string;
  endOffset: number;
}): Range | null => {
  try {
    const startNode = getNodeByXPath(serializedRange.startPath);
    const endNode = getNodeByXPath(serializedRange.endPath);
    
    if (!startNode || !endNode) {
      console.warn('Could not find nodes for XPath:', serializedRange);
      return null;
    }
    
    const range = document.createRange();
    range.setStart(startNode, serializedRange.startOffset);
    range.setEnd(endNode, serializedRange.endOffset);
    
    return range;
  } catch (error) {
    console.error('Error deserializing range:', error);
    return null;
  }
};

/**
 * Gets a DOM node by its XPath
 * @param xpath The XPath string
 * @returns The node or null if not found
 */
const getNodeByXPath = (xpath: string): Node | null => {
  try {
    const result = document.evaluate(
      xpath,
      document,
      null,
      XPathResult.FIRST_ORDERED_NODE_TYPE,
      null
    );
    return result.singleNodeValue;
  } catch (error) {
    console.error('Error evaluating XPath:', xpath, error);
    return null;
  }
};

/**
 * Reapplies a saved highlight to the page
 * @param highlightData The saved highlight data
 * @returns Promise<boolean> Success status
 */
export const reapplyHighlight = async (highlightData: {
  id: string;
  text: string;
  color: string;
  serializedRange: any;
}): Promise<boolean> => {
  try {
    const range = deserializeRange(highlightData.serializedRange);
    if (!range) {
      console.warn('Could not deserialize range for highlight:', highlightData.id);
      return false;
    }
    
    // Verify the text still matches (content hasn't changed)
    const currentText = range.toString();
    if (currentText !== highlightData.text) {
      console.warn('Text content has changed, skipping highlight:', highlightData.id);
      return false;
    }
    
    // Reapply the highlight using the same logic as new highlights
    return await createAdvancedHighlight(range, highlightData.color, highlightData.id);
  } catch (error) {
    console.error('Error reapplying highlight:', error);
    return false;
  }
};

/**
 * Restores all highlights for the current page
 * @returns Promise<number> Number of highlights restored
 */
export const restoreHighlights = async (): Promise<number> => {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({
      type: 'GET_HIGHLIGHTS_FOR_URL',
      url: window.location.href
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error getting highlights:', chrome.runtime.lastError);
        resolve(0);
        return;
      }
      
      if (!response || !response.highlights) {
        console.log('No highlights found for current URL');
        resolve(0);
        return;
      }
      
      console.log(`Restoring ${response.highlights.length} highlights`);
      let restoredCount = 0;
      
      // Process highlights sequentially with async/await
      const processHighlights = async () => {
        for (const highlight of response.highlights) {
          const success = await reapplyHighlight(highlight);
          if (success) {
            restoredCount++;
          }
        }
        
        console.log(`Successfully restored ${restoredCount} highlights`);
        resolve(restoredCount);
      };
      
      processHighlights();
    });
  });
};

/**
 * Debug function to help identify correct response container selectors for each platform.
 * Call this in the console to see what selectors are available on the current page.
 */
export const debugResponseContainers = () => {
    console.log('=== Debugging AI Response Containers ===');
    const platform = getPlatformName();
    console.log(`Current platform: ${platform}`);
    console.log(`Current URL: ${window.location.href}`);
    
    // Log all potential selectors for different platforms
    console.log('\n--- Available AI response elements ---');
    
    // Claude
    console.log('\nClaude selectors:');
    console.log('[data-message-author-role="assistant"]:', document.querySelectorAll('[data-message-author-role="assistant"]').length);
    console.log('.prose:', document.querySelectorAll('.prose').length);
    console.log('.contents:', document.querySelectorAll('.contents').length);
    console.log('.claude-answer:', document.querySelectorAll('.claude-answer').length);
    console.log('.message-content[data-message-side="received"]:', document.querySelectorAll('.message-content[data-message-side="received"]').length);
    console.log('.message-thread__message--ai:', document.querySelectorAll('.message-thread__message--ai').length);
    
    // Gemini
    console.log('\nGemini selectors:');
    console.log('[data-model-response]:', document.querySelectorAll('[data-model-response]').length);
    console.log('[data-testid*="response"]:', document.querySelectorAll('[data-testid*="response"]').length);
    console.log('[role="region"]:', document.querySelectorAll('[role="region"]').length);
    console.log('.gemini-response-content:', document.querySelectorAll('.gemini-response-content').length);
    console.log('.response-container:', document.querySelectorAll('.response-container').length);
    console.log('.model-response-text:', document.querySelectorAll('.model-response-text').length);
    console.log('.bard-response:', document.querySelectorAll('.bard-response').length);
    
    // DeepSeek
    console.log('\nDeepSeek selectors:');
    console.log('.chat-message-item[data-role="assistant"]:', document.querySelectorAll('.chat-message-item[data-role="assistant"]').length);
    console.log('.message-content:', document.querySelectorAll('.message-content').length);
    console.log('.deepseek-response:', document.querySelectorAll('.deepseek-response').length);
    console.log('.ai-message-container:', document.querySelectorAll('.ai-message-container').length);
    console.log('.ai-response-content:', document.querySelectorAll('.ai-response-content').length);
    
    // Generic AI response indicators
    console.log('\nGeneric AI response selectors:');
    console.log('[data-role="assistant"]:', document.querySelectorAll('[data-role="assistant"]').length);
    console.log('.assistant-message:', document.querySelectorAll('.assistant-message').length);
    console.log('.ai-message:', document.querySelectorAll('.ai-message').length);
    
    console.log('\n=== End Debug Report ===');
};

/**
 * Provides specific selectors for both user prompts and assistant responses
 * based on the provided DOM screenshots.
 * @param {string} platform The current AI platform.
 * @returns {object} Object containing userPromptSelectors, assistantResponseSelectors arrays, and optional turnContainer.
 */
export const getConversationSelectors = (platform: string): {
  userPromptSelectors: string[];
  assistantResponseSelectors: string[];
  turnContainer?: string;
} => {
  switch (platform) {
    case 'ChatGPT':
      return {
        userPromptSelectors: ['div[data-message-author-role="user"]'],
        assistantResponseSelectors: ['div[data-message-author-role="assistant"] .prose'],
      };
    case 'Claude':
      return {
        userPromptSelectors: ['div[data-message-author-role="user"]'],
        assistantResponseSelectors: ['div[contenteditable="true"].ProseMirror'],
      };
    case 'DeepSeek':
      return {
        userPromptSelectors: ['.chat-message-item[data-role="user"]'],
        assistantResponseSelectors: ['div.ds-markdown.ds-markdown-block'],
        turnContainer: 'div.message-container',
      };
    case 'Grok':
      return {
        userPromptSelectors: ['div[data-testid*="user-message"]'],
        assistantResponseSelectors: ['div[class*="break-words"] p[dir="auto"]'],
      };
    case 'Gemini':
      return {
        userPromptSelectors: [
          'div.query-text', // Primary selector for the text itself
          'div.user-query-container.user-query-bubble-container' // Secondary container as a fallback
        ],
        assistantResponseSelectors: ['.model-response-text'],
        turnContainer: 'div.conversation-turn',
      };
    default:
      return {
        userPromptSelectors: ['[data-role="user"]', '.user-message'],
        assistantResponseSelectors: ['[data-role="assistant"]', '.assistant-message'],
      };
  }
};

/**
 * Extracts conversation details (URL and chat ID) from the current page
 * @returns Object containing the full URL and extracted chat ID
 */
export const getConversationDetails = (): { url: string; chatId: string | null } => {
  const currentUrl = window.location.href;
  const hostname = window.location.hostname;
  
  let chatId: string | null = null;
  
  if (hostname.includes('chatgpt.com')) {
    // ChatGPT: chatgpt.com/c/{chatId}
    const match = currentUrl.match(/chatgpt\.com\/c\/([^/?#]+)/);
    chatId = match ? match[1] : null;
  } else if (hostname.includes('claude.ai')) {
    // Claude: claude.ai/chat/{chatId}
    const match = currentUrl.match(/claude\.ai\/chat\/([^/?#]+)/);
    chatId = match ? match[1] : null;
  } else if (hostname.includes('grok.com') || hostname.includes('x.com')) {
    // Grok: grok.com/c/{chatId} or x.com/i/grok/c/{chatId}
    const match = currentUrl.match(/(?:grok\.com\/c\/|x\.com\/i\/grok\/c\/)([^/?#]+)/);
    chatId = match ? match[1] : null;
  } else if (hostname.includes('gemini.google.com')) {
    // Gemini: gemini.google.com/app/{chatId}
    const match = currentUrl.match(/gemini\.google\.com\/app\/([^/?#]+)/);
    chatId = match ? match[1] : null;
  } else if (hostname.includes('deepseek.com')) {
    // DeepSeek: chat.deepseek.com/coder/{chatId}
    const match = currentUrl.match(/deepseek\.com\/coder\/([^/?#]+)/);
    chatId = match ? match[1] : null;
  }
  
  return {
    url: currentUrl,
    chatId: chatId
  };
};

/**
 * Gets the supported features for the current platform
 * @param platform The current AI platform
 * @returns Object containing which features are supported
 */
export const getSupportedFeatures = (platform: string) => {
  switch (platform) {
    case 'ChatGPT':
    case 'Claude':
    case 'Grok':
      return {
        inlineHighlighting: true,
        keyboardShortcuts: true,
        sidePanelSnippets: true,
        dragAndDrop: true
      };
    
    case 'Gemini':
    case 'DeepSeek':
      return {
        inlineHighlighting: false, // Disabled due to Angular DOM issues
        keyboardShortcuts: false,  // Disabled due to inline highlighting issues
        sidePanelSnippets: true,   // Our new primary feature
        dragAndDrop: true          // Our new primary feature
      };
    
    default:
      return {
        inlineHighlighting: true,
        keyboardShortcuts: true,
        sidePanelSnippets: true,
        dragAndDrop: true
      };
  }
};