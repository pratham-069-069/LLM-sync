import { getPlatformName, getConversationSelectors } from '../content-scripts/dom_utils';
import type { Message } from '../types';

export interface ContextItem {
  type: 'user' | 'primary' | 'sidekick';
  content: string;
  timestamp: number;
}

export interface ConversationContext {
  primaryPlatform: string;
  sidekickPlatform: string;
  role: string;
  history: ContextItem[];
  timestamp: number;
}

export interface MessageContext {
  messages: Message[];
}

class ContextManager {
  private currentContext: ConversationContext | null = null;

  /**
   * Saves the current context to chrome.storage.local
   */
  private async saveContextToStorage(): Promise<void> {
    if (!this.currentContext) return;
    
    try {
      await chrome.storage.local.set({
        'conversationContext': this.currentContext
      });
      console.log('ContextManager: Context saved to storage');
    } catch (error) {
      console.error('ContextManager: Failed to save context to storage:', error);
    }
  }

  /**
   * Loads the context from chrome.storage.local
   */
  private async loadContextFromStorage(): Promise<ConversationContext | null> {
    try {
      const result = await chrome.storage.local.get('conversationContext');
      if (result.conversationContext) {
        console.log('ContextManager: Context loaded from storage');
        return result.conversationContext as ConversationContext;
      }
      console.log('ContextManager: No existing context found in storage');
      return null;
    } catch (error) {
      console.error('ContextManager: Failed to load context from storage:', error);
      return null;
    }
  }

  public async initializeContext(sidekickPlatform: string, role: string): Promise<ConversationContext> {
    // First, try to load existing context from storage
    const existingContext = await this.loadContextFromStorage();
    
    if (existingContext) {
      this.currentContext = existingContext;
      console.log('ContextManager: Loaded existing context from storage.', this.currentContext);
      return this.currentContext;
    }
    
    // If no existing context, create a new one
    this.currentContext = {
      primaryPlatform: getPlatformName(),
      sidekickPlatform,
      role,
      history: [],
      timestamp: Date.now(),
    };
    
    // Save the new context to storage
    await this.saveContextToStorage();
    console.log('ContextManager: Initialized new context and saved to storage.', this.currentContext);
    return this.currentContext;
  }

  public async addUserMessage(content: string): Promise<void> {
    if (!this.currentContext) return;
    this.currentContext.history.push({
      type: 'user',
      content,
      timestamp: Date.now(),
    });
    await this.saveContextToStorage();
  }

  public async addPrimaryResponseMessage(content: string): Promise<void> {
    if (!this.currentContext) return;
    this.currentContext.history.push({
      type: 'primary',
      content,
      timestamp: Date.now(),
    });
    await this.saveContextToStorage();
  }

  public async addSidekickResponseMessage(content: string): Promise<void> {
    if (!this.currentContext) return;
    this.currentContext.history.push({
      type: 'sidekick',
      content,
      timestamp: Date.now(),
    });
    await this.saveContextToStorage();
  }

  public getLatestExchange(): { prompt?: string; response?: string } {
    if (!this.currentContext || this.currentContext.history.length === 0) {
      return {};
    }
    const reversedHistory = [...this.currentContext.history].reverse();
    const lastPrimaryResponse = reversedHistory.find(item => item.type === 'primary');
    const lastUserPrompt = reversedHistory.find(item => item.type === 'user');

    return {
      prompt: lastUserPrompt?.content,
      response: lastPrimaryResponse?.content,
    };
  }

  public getConversationHistory(): ContextItem[] {
    return this.currentContext?.history || [];
  }

  public getCurrentContext(): ConversationContext | null {
    return this.currentContext;
  }

  public async getContext(platform: string, targetElement: HTMLElement): Promise<MessageContext | null> {
    const selectors = getConversationSelectors(platform);
    if (!selectors.userPromptSelectors.length || !selectors.assistantResponseSelectors.length) {
      return null;
    }

    console.log('ContextManager: Building context using relative DOM traversal for', platform);
    
    const messages: Message[] = [];
    
    // Get the AI response content from the target element
    const assistantContent = targetElement.innerText || targetElement.textContent || '';
    if (!assistantContent.trim()) {
      console.warn('ContextManager: Target element has no text content');
      return null;
    }

    // For platforms with turnContainer, use relative traversal
    const turnContainerSelector = (selectors as any).turnContainer;
    if (turnContainerSelector) {
      console.log('ContextManager: Using turnContainer approach for', platform);
      
      // Find the conversation turn container by traversing up the DOM
      const turnContainer = targetElement.closest(turnContainerSelector);
      
      if (turnContainer) {
        console.log('ContextManager: Found turn container:', turnContainer);
        
        // Look for user prompt within this turn container
        console.log(`ContextManager: Searching for user prompt in ${platform} turn container using selectors:`, selectors.userPromptSelectors);
        let userPromptElement: HTMLElement | null = null;
        
        for (const userSelector of selectors.userPromptSelectors) {
          console.log(`ContextManager: Trying user selector: "${userSelector}"`);
          userPromptElement = turnContainer.querySelector(userSelector) as HTMLElement;
          if (userPromptElement) {
            console.log(`✅ ContextManager: Found user prompt in ${platform} with selector: "${userSelector}"`);
            console.log('ContextManager: User prompt element:', userPromptElement);
            break;
          } else {
            console.log(`❌ ContextManager: No user prompt found with selector: "${userSelector}"`);
          }
        }
        
        if (userPromptElement) {
          const userContent = userPromptElement.innerText || userPromptElement.textContent || '';
          console.log(`ContextManager: User prompt text content: "${userContent.substring(0, 100)}${userContent.length > 100 ? '...' : ''}"`);
          if (userContent.trim()) {
            console.log(`✅ ContextManager: Successfully extracted user prompt for ${platform}`);
            messages.push({
              role: 'user',
              content: userContent.trim(),
              position: 0 // User message comes first
            });
          } else {
            console.warn(`⚠️ ContextManager: User prompt element found but has no text content in ${platform}`);
          }
        } else {
          console.warn(`❌ ContextManager: Could not find user prompt within ${platform} turn container using any selector`);
        }
        
        // Add the assistant response
        messages.push({
          role: 'assistant',
          content: assistantContent.trim(),
          position: 1 // Assistant response comes second
        });
        
      } else {
        console.warn('ContextManager: Could not find turn container, falling back to assistant-only context');
        
        // Fallback: return context with just the assistant response
        messages.push({
          role: 'assistant',
          content: assistantContent.trim(),
          position: 0
        });
      }
      
    } else {
      console.log('ContextManager: No turnContainer defined, using fallback approach');
      
      // Fallback for platforms without turnContainer: return just the assistant response
      messages.push({
        role: 'assistant',
        content: assistantContent.trim(),
        position: 0
      });
    }

    if (messages.length === 0) {
      console.error('ContextManager: No messages found');
      return null;
    }

    console.log(`ContextManager: Built context with ${messages.length} messages`);
    return { messages };
  }
}

export default new ContextManager();
