import { OPENROUTER_API_KEY } from '../lib/constants';

class ApiService {
  private readonly openRouterUrl = 'https://openrouter.ai/api/v1/chat/completions';

  public async getGeminiFlashAnalysis(metaPrompt: string): Promise<string> {
    // Validate API key format (should start with 'sk-or-v1-' for OpenRouter)
    const apiKey = OPENROUTER_API_KEY;
    if (!apiKey || typeof apiKey !== 'string') {
      const errorMessage = 'Error: Invalid or missing OpenRouter API key. Please check your key in `src/lib/constants.ts`.';
      console.error('NexusMind Error:', errorMessage);
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
        console.error('NexusMind API Error:', response.status, errorBody);
        return `Error: API request failed with status ${response.status}. ${errorBody}`;
      }

      const data = await response.json();
      const analysis = data.choices[0]?.message?.content;

      if (!analysis) {
        console.error('NexusMind API Error: Invalid response structure from OpenRouter.');
        return 'Error: Could not extract analysis from API response.';
      }

      console.log('NexusMind: ApiService received analysis from Gemini Flash.');
      return analysis;
    } catch (error) {
      console.error('NexusMind: Error calling OpenRouter API:', error);
      return `Error: Could not fetch analysis. ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
}

export default new ApiService();

