import {
    getPlatformName,
    getInputSelectors,
    getSendButtonSelectors,
    getChatContainerSelector,
    waitForElement,
    setTextContent,
    clickSendButton,
    tryEnterKey,
    waitForResponseCompletion,
    readLatestResponse
} from './dom_utils';

console.log('🧩 Multi-platform content script loaded on', location.href);

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