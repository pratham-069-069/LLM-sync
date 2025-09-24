import { getPlatformName } from '../content-scripts/dom_utils';

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
}

export default new ContextManager();
