import type { SidekickConfig } from '../types';
import ContextManager from './ContextManager';

class RoutingIntelligence {
  public generateMetaPrompt(role: string, originalPrompt: string, primaryResponse: string): string {
    switch (role) {
      case 'Critic':
        return `Original Prompt: "${originalPrompt}"\n\nPrimary AI Response: "${primaryResponse}"\n\nYour Task: Critique the Primary AI Response for clarity, accuracy, and completeness. Be specific and constructive.`;
      case 'Fact-Checker':
        return `Original Prompt: "${originalPrompt}"\n\nPrimary AI Response: "${primaryResponse}"\n\nYour Task: Fact-check the Primary AI Response. Identify any factual errors or unsubstantiated claims. Provide corrections with brief explanations.`;
      case 'Alternative View':
        return `Original Prompt: "${originalPrompt}"\n\nPrimary AI Response: "${primaryResponse}"\n\nYour Task: Provide an alternative perspective to the original prompt. Do not critique the response, but offer a complementary or different viewpoint.`;
      default:
        return `Analyze the following exchange.\n\nUser: ${originalPrompt}\n\nAI: ${primaryResponse}`;
    }
  }

  public getSidekickPrompt(config: SidekickConfig): string | null {
    const { prompt, response } = ContextManager.getLatestExchange();
    if (!prompt || !response) {
      console.warn('RoutingIntelligence: Could not find a complete prompt/response exchange.');
      return null;
    }
    return this.generateMetaPrompt(config.role, prompt, response);
  }
}

export default new RoutingIntelligence();
