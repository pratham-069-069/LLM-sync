import type { SidekickConfig } from '../types';
import { getPlatformName, getResponseSelectors } from '../content-scripts/dom_utils';
import ContextManager from './ContextManager';
import RoutingIntelligence from './RoutingIntelligence';
import ApiService from './ApiService';

export class SidekickManager {
  private static instance: SidekickManager;
  private observer: MutationObserver | null = null;
  private isSidekickActive: boolean = false;
  private currentConfig: SidekickConfig | null = null;
  private platformName: string;
  private processingNodes: WeakSet<HTMLElement> = new WeakSet();

  private constructor() {
    this.platformName = getPlatformName();
  }

  public static getInstance(): SidekickManager {
    if (!SidekickManager.instance) {
      SidekickManager.instance = new SidekickManager();
    }
    return SidekickManager.instance;
  }

  public start(config: SidekickConfig) {
    if (this.isSidekickActive) {
      this.stop();
    }

    this.isSidekickActive = true;
    this.currentConfig = config;
    ContextManager.initializeContext(config.platform, config.role);
    console.log('NexusMind: SidekickManager started with config:', config);

    if (this.platformName === 'Unknown') {
      console.error('NexusMind: Sidekick cannot start, unknown platform.');
      return;
    }

    this.startObserver();
  }

  public stop() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.isSidekickActive = false;
    this.currentConfig = null;
    console.log('NexusMind: SidekickManager stopped.');
  }

  private startObserver() {
    const responseSelector = getResponseSelectors(this.platformName).join(', ');
    if (!responseSelector) {
      console.error(`NexusMind: No response selectors found for platform: ${this.platformName}`);
      return;
    }

    console.log(`NexusMind: Observing for new responses with selectors: "${responseSelector}"`);

    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as HTMLElement;
            
            // Check if the added element itself matches, or contains a match
            const matchingElements = element.matches(responseSelector) 
              ? [element] 
              : Array.from(element.querySelectorAll<HTMLElement>(responseSelector));

            matchingElements.forEach(el => {
              if (!this.processingNodes.has(el)) {
                this.processLatestMessage(el);
              }
            });
          }
        });
      }
    });

    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  private findUserPrompt(): string {
    const platform = getPlatformName();
    
    // Platform-specific selectors for user messages
    const userSelectors: { [key: string]: string[] } = {
      'ChatGPT': [
        '[data-testid="user-message"]',
        '[data-message-author-role="user"]',
        '.font-user-message',
        '[class*="user-message"]'
      ],
      'Claude': [
        '[data-is-user-message="true"]',
        '.user-message',
        '[class*="user"]'
      ],
      'Gemini': [
        '.user-message',
        '[data-role="user"]'
      ]
    };

    const selectorsToTry = userSelectors[platform] || userSelectors['ChatGPT'];
    
    for (const selector of selectorsToTry) {
      const userElements = document.querySelectorAll(selector);
      if (userElements && userElements.length > 0) {
        // Get the last user message (most recent)
        const lastUserElement = userElements[userElements.length - 1] as HTMLElement;
        const promptText = lastUserElement.innerText?.trim();
        
        if (promptText && promptText.length > 0) {
          console.log(`🤖 NexusMind: Found prompt using selector "${selector}": "${promptText.substring(0, 50)}..."`);
          return promptText;
        }
      }
    }
    
    console.warn('🤖 NexusMind: Could not find user prompt with any selector');
    return "User prompt not found";
  }

  private async processLatestMessage(botResponseElement: HTMLElement) {
    if (!this.isSidekickActive || !this.currentConfig) return;

    this.processingNodes.add(botResponseElement);
    console.log('NexusMind: Detected new response element.', botResponseElement);

    // Extract the text from the response
    const botResponse = botResponseElement.innerText?.trim();
    if (!botResponse || botResponse.length < 3) {
      console.warn('NexusMind: Empty or too short response text, skipping analysis');
      setTimeout(() => this.processingNodes.delete(botResponseElement), 500);
      return;
    }

    // Find the user's prompt using the improved method
    const userPrompt = this.findUserPrompt();
    
    // Check if we have both prompt and response
    if (!userPrompt || userPrompt === "User prompt not found" || userPrompt.length < 3) {
      console.warn('NexusMind: Could not find user prompt, skipping analysis');
      setTimeout(() => this.processingNodes.delete(botResponseElement), 500);
      return;
    }

    if (!userPrompt?.trim() || !botResponse?.trim()) {
      console.warn('NexusMind: Prompt or response is empty, skipping analysis.');
      setTimeout(() => this.processingNodes.delete(botResponseElement), 500);
      return;
    }

    console.log(`NexusMind: Processing - Prompt: "${userPrompt.substring(0, 50)}..." Response: "${botResponse.substring(0, 50)}..."`);

    // Store the conversation context
    ContextManager.addUserMessage(userPrompt);
    ContextManager.addPrimaryResponseMessage(botResponse);

    try {
      const metaPrompt = RoutingIntelligence.generateMetaPrompt(
        this.currentConfig.role,
        userPrompt,
        botResponse
      );

      console.log('NexusMind: Sending for analysis...');
      const analysis = await ApiService.getGeminiFlashAnalysis(metaPrompt);
      ContextManager.addSidekickResponseMessage(analysis);

      document.dispatchEvent(new CustomEvent('nexusmind-sidekick-response', {
        detail: {
          targetElement: botResponseElement,
          analysis,
          config: this.currentConfig,
        }
      }));

      console.log('NexusMind: Analysis complete and event dispatched');
    } catch (error) {
      console.error('NexusMind: Error during analysis:', error);
    } finally {
      setTimeout(() => this.processingNodes.delete(botResponseElement), 500);
    }
  }
}

export default SidekickManager.getInstance();


