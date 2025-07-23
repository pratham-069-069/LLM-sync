console.log('🧩 Multi-platform content script loaded on', location.href);

// Platform detection
const getPlatformName = (): string => {
  const hostname = location.hostname;

  if (hostname.includes('chatgpt.com')) return 'ChatGPT';
  if (hostname.includes('claude.ai')) return 'Claude';
  if (hostname.includes('deepseek.com')) return 'DeepSeek';
  if (hostname.includes('grok.com') || hostname.includes('x.com')) return 'Grok';
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

// Get platform-specific selectors
const getInputSelectors = (platform: string): string[] => {
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

const getSendButtonSelectors = (platform: string): string[] => {
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

// Fixed response selectors - focusing on complete response containers
const getResponseSelectors = (platform: string): string[] => {
    switch (platform) {
      case 'ChatGPT': 
        return ['div[data-message-author-role="assistant"] .prose'];
      case 'Claude': 
        return ['div.font-claude-message'];
      case 'Gemini': 
        return ['.model-response-text .markdown'];
      case 'DeepSeek': 
        return [
          'div.ds-markdown.ds-markdown-block',     // Main container for complete response
          'div.ds-markdown-block',                 // Alternative container
          'div[class*="ds-markdown-block"]'        // Fallback with partial match
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
        return ['.assistant-response', '.model-output'];
    }
};

const getChatContainerSelector = (platform: string): string => {
    switch(platform) {
        case 'ChatGPT': return 'div[class*="react-scroll-to-bottom"]';
        case 'Claude': return '[data-testid="conversation-container"]';
        case 'Gemini': return '.chat-history';
        case 'DeepSeek': return '.chat-container';
        case 'Grok': return 'main, div[class*="flex"][class*="flex-col"], div[class*="relative"], body';
        default: return 'main';
    }
};

const clickSendButton = (button: HTMLElement, platform: string) => {
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

const tryEnterKey = (inputField: HTMLElement, platform: string) => {
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

// ✨ COMPLETELY REWRITTEN: Fixed readLatestResponse function
const readLatestResponse = async (platform: string): Promise<string> => {
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

const waitForResponseCompletion = (platform: string, responseContainerSelector: string): Promise<void> => {
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

// Main message listener
if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
        const platform = getPlatformName();

        if (msg.type === 'INJECT_PROMPT') {
            const injectAndSend = async () => {
                try {
                    let inputField: HTMLElement | null = null;
                    const selectors = getInputSelectors(platform);
                    
                    for (const selector of selectors) {
                        try {
                            inputField = await waitForElement(selector, 2000);
                            if (inputField) {
                                console.log(`✅ Found input field with selector: ${selector}`);
                                break;
                            }
                        } catch (err) { 
                            console.log(`⚠️ Input selector failed: ${selector}`);
                        }
                    }
                    
                    if (!inputField) throw new Error('No visible text input found.');
                    
                    setTextContent(inputField, msg.prompt, platform);
                    await new Promise(resolve => setTimeout(resolve, platform === 'Grok' ? 500 : 300));
                    
                    let sendButton: HTMLElement | undefined;
                    const buttonSelectors = getSendButtonSelectors(platform);
                    
                    for (const selector of buttonSelectors) {
                        try {
                            sendButton = await waitForElement(selector, 1000);
                            if (sendButton) {
                                console.log(`✅ Found send button with selector: ${selector}`);
                                break;
                            }
                        } catch (err) { 
                            console.log(`⚠️ Send button selector failed: ${selector}`);
                        }
                    }
                    
                    if (sendButton) {
                        clickSendButton(sendButton, platform);
                    } else {
                        console.log('⚠️ No send button found, trying Enter key...');
                        tryEnterKey(inputField, platform);
                    }

                    const containerSelector = getChatContainerSelector(platform);
                    await waitForResponseCompletion(platform, containerSelector);

                    sendResponse({ success: true });

                } catch (err) {
                    console.error(`❌ Error during INJECT_PROMPT for ${platform}:`, err);
                    sendResponse({ success: false, error: err instanceof Error ? err.message : String(err) });
                }
            };
            injectAndSend();
            return true;
        }
        
        else if (msg.type === 'READ_LATEST_RESPONSE') {
            readLatestResponse(platform)
                .then(response => sendResponse({ success: true, response: response }))
                .catch(err => sendResponse({ success: false, error: err.message }));
            return true;
        }
    });
    console.log('🧩 Content script message listener registered successfully');
}