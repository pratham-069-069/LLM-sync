import { OPENROUTER_API_KEY } from '../lib/constants';

/**
 * ApiService - Legacy service for direct API calls
 * 
 * NOTE: This service is being phased out in favor of the new architecture:
 * - MediatorService: Handles intelligent meta-prompt generation and mediation
 * - SidekickManager: Coordinates Worker AI execution
 * 
 * This service is maintained for backward compatibility and edge cases.
 */
class ApiService {
  private readonly openRouterUrl = 'https://openrouter.ai/api/v1/chat/completions';

  /**
   * Direct Gemini Flash analysis - DEPRECATED
   * Use MediatorService.generateMetaPrompt() instead for intelligent mediation
   * @deprecated Use MediatorService for new implementations
   */
  public async getGeminiFlashAnalysis(metaPrompt: string): Promise<string> {
    console.warn('⚠️ ApiService.getGeminiFlashAnalysis() is deprecated. Use MediatorService instead.');
    
    // Validate API key format (should start with 'sk-or-v1-' for OpenRouter)
    const apiKey = OPENROUTER_API_KEY;
    if (!apiKey || typeof apiKey !== 'string') {
      const errorMessage = 'Error: Invalid or missing OpenRouter API key. Please check your key in `src/lib/constants.ts`.';
      console.error('🔧 ApiService Error:', errorMessage);
      return errorMessage;
    }

    try {
      const response = await fetch(this.openRouterUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://nexusmind.dev', // Site URL for rankings on openrouter.ai
          'X-Title': 'NexusMind AI Sidekick', // Site title for rankings on openrouter.ai
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'google/gemini-2.0-flash-exp:free',
          messages: [
            {
              role: 'user',
              content: metaPrompt
            }
          ],
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error('🔧 ApiService API Error:', response.status, errorBody);
        return `Error: API request failed with status ${response.status}. ${errorBody}`;
      }

      const data = await response.json();
      const analysis = data.choices[0]?.message?.content;

      if (!analysis) {
        console.error('🔧 ApiService API Error: Invalid response structure from OpenRouter.');
        return 'Error: Could not extract analysis from API response.';
      }

      console.log('🔧 ApiService: Received analysis from Gemini Flash (deprecated path).');
      return analysis;
    } catch (error) {
      console.error('🔧 ApiService: Error calling OpenRouter API:', error);
      return `Error: Could not fetch analysis. ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  /**
   * Generic OpenRouter API call method
   * Can be used for future features that need direct API access
   */
  public async callOpenRouter(
    model: string,
    messages: Array<{role: string, content: string}>,
    options?: {
      temperature?: number;
      max_tokens?: number;
      top_p?: number;
    }
  ): Promise<{success: boolean; result?: string; error?: string}> {
    const apiKey = OPENROUTER_API_KEY;
    if (!apiKey || typeof apiKey !== 'string') {
      return {
        success: false,
        error: 'Invalid or missing OpenRouter API key'
      };
    }

    try {
      const response = await fetch(this.openRouterUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://nexusmind.dev',
          'X-Title': 'NexusMind AI Enhancement',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: options?.temperature ?? 0.7,
          max_tokens: options?.max_tokens,
          top_p: options?.top_p ?? 1,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        return {
          success: false,
          error: `API request failed with status ${response.status}: ${errorBody}`
        };
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;

      if (!content) {
        return {
          success: false,
          error: 'Invalid response structure from OpenRouter API'
        };
      }

      return {
        success: true,
        result: content
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

export default new ApiService();

