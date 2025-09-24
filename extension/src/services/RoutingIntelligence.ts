import type { SidekickConfig } from '../types';
import ContextManager from './ContextManager';

class RoutingIntelligence {

  public getSidekickPrompt(config: SidekickConfig): string | null {
    const { prompt, response } = ContextManager.getLatestExchange();
    if (!prompt || !response) {
      console.warn('RoutingIntelligence: Could not find a complete prompt/response exchange.');
      return null;
    }
    
    // Use the custom prompt directly with context
    return `${config.customPrompt}\n\nOriginal User Question:\n${prompt}\n\nAI Response to Analyze:\n${response}\n\nYour Analysis:`;
  }
}

export default new RoutingIntelligence();
