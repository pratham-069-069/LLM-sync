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

  public initializeContext(sidekickPlatform: string, role: string): ConversationContext {
    this.currentContext = {
      primaryPlatform: getPlatformName(),
      sidekickPlatform,
      role,
      history: [],
      timestamp: Date.now(),
    };
    console.log('ContextManager: Initialized new context.', this.currentContext);
    return this.currentContext;
  }

  public addUserMessage(content: string): void {
    if (!this.currentContext) return;
    this.currentContext.history.push({
      type: 'user',
      content,
      timestamp: Date.now(),
    });
  }

  public addPrimaryResponseMessage(content: string): void {
    if (!this.currentContext) return;
    this.currentContext.history.push({
      type: 'primary',
      content,
      timestamp: Date.now(),
    });
  }

  public addSidekickResponseMessage(content: string): void {
    if (!this.currentContext) return;
    this.currentContext.history.push({
      type: 'sidekick',
      content,
      timestamp: Date.now(),
    });
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
