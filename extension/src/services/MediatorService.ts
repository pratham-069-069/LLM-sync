/**
 * MediatorService.ts
 * 
 * The "Brain" of the NexusMind extension. This service handles all intelligent tasks:
 * - Generating meta-prompts for Worker AIs
 * - Summarizing conversations
 * - Enhancing user prompts
 * - Making intelligent routing decisions
 * 
 * This service uses both OpenRouter and Google AI Studio for redundancy and reliability.
 */

import { GoogleGenAI } from '@google/genai';
import { OPENROUTER_API_KEY, GEMINI_API_KEY } from '../lib/constants';

export interface MediationRequest {
  type: 'meta-prompt' | 'summarize' | 'enhance-prompt' | 'routing-decision';
  userPrompt: string;
  primaryResponse?: string;
  role?: string;
  conversationHistory?: string;
  targetWorkerAI?: string;
}

export interface MediationResult {
  success: boolean;
  result?: string;
  error?: string;
  metadata?: {
    tokensUsed?: number;
    processingTime?: number;
    confidence?: number;
  };
}

class MediatorService {
  private readonly openRouterUrl = 'https://openrouter.ai/api/v1/chat/completions';
  private readonly mediatorModel = 'google/gemini-2.0-flash-exp:free';

  /**
   * Generate an optimized prompt for a Worker AI using the user's custom instruction and conversation context
   * This is the core mediation task - turning custom instructions and conversation history into targeted prompts
   */
  public async generateMediatedPrompt(
    userInstruction: string,
    conversationHistory: string,
    targetWorkerAI: string
  ): Promise<MediationResult> {
    console.log('🧠 MediatorService: Generating mediated prompt for target AI:', targetWorkerAI);
    
    const startTime = Date.now();
    
    try {
      const systemPrompt = this.getMediatedPromptSystemPrompt(targetWorkerAI);
      const userContent = this.formatContextForMediation(userInstruction, conversationHistory);

      const mediatedPrompt = await this.callMediatorAI(systemPrompt, userContent);
      
      const processingTime = Date.now() - startTime;
      
      console.log(`🧠 MediatorService: Mediated prompt generated successfully in ${processingTime}ms`);
      console.log(`🧠 MediatorService: Preview: "${mediatedPrompt.substring(0, 100)}..."`);
      
      return {
        success: true,
        result: mediatedPrompt,
        metadata: {
          processingTime,
          confidence: 0.95 // High confidence for mediated prompt generation
        }
      };
    } catch (error) {
      console.error('🧠 MediatorService: Error generating mediated prompt:', error);
      
      // Provide an intelligent fallback prompt
      const fallbackPrompt = this.generateFallbackMediatedPrompt(userInstruction, conversationHistory);
      
      return {
        success: true, // Still successful, just using fallback
        result: fallbackPrompt,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          processingTime: Date.now() - startTime,
          confidence: 0.7 // Lower confidence for fallback
        }
      };
    }
  }

  /**
   * Summarize a conversation or set of highlights for memory/context purposes
   */
  public async summarizeConversation(
    conversationHistory: string,
    focusArea?: string
  ): Promise<MediationResult> {
    console.log('🧠 MediatorService: Summarizing conversation, focus:', focusArea || 'general');
    
    const startTime = Date.now();
    
    try {
      const systemPrompt = `You are an intelligent conversation summarizer. Create concise, actionable summaries that preserve key insights and decisions.

Focus: ${focusArea || 'Capture main topics, decisions, and action items'}

Guidelines:
- Extract key topics and themes
- Identify important decisions or conclusions
- Note any action items or next steps
- Preserve context for future reference
- Keep summary concise but comprehensive`;

      const userContent = `Summarize this conversation:

${conversationHistory}

Provide a structured summary with:
1. Main Topics
2. Key Insights
3. Decisions Made
4. Action Items (if any)`;

      const summary = await this.callMediatorAI(systemPrompt, userContent);
      
      return {
        success: true,
        result: summary,
        metadata: {
          processingTime: Date.now() - startTime,
          confidence: 0.9
        }
      };
    } catch (error) {
      console.error('🧠 MediatorService: Error summarizing conversation:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          processingTime: Date.now() - startTime
        }
      };
    }
  }

  /**
   * Enhance a user's prompt to be more effective
   */
  public async enhancePrompt(
    originalPrompt: string,
    targetAI?: string,
    desiredOutcome?: string
  ): Promise<MediationResult> {
    console.log('🧠 MediatorService: Enhancing prompt for target:', targetAI || 'any AI');
    
    const startTime = Date.now();
    
    try {
      const systemPrompt = `You are a prompt engineering expert. Your job is to rewrite user prompts to be more effective and get better results from AI systems.

Target AI: ${targetAI || 'General AI'}
Desired Outcome: ${desiredOutcome || 'High-quality, detailed response'}

Guidelines:
- Make prompts more specific and detailed
- Add context where helpful
- Specify desired format or structure
- Include relevant constraints or requirements
- Maintain the original intent
- Don't answer the prompt, just improve it`;

      const userContent = `Enhance this prompt:

"${originalPrompt}"

Return only the enhanced prompt, nothing else.`;

      const enhancedPrompt = await this.callMediatorAI(systemPrompt, userContent);
      
      return {
        success: true,
        result: enhancedPrompt,
        metadata: {
          processingTime: Date.now() - startTime,
          confidence: 0.85
        }
      };
    } catch (error) {
      console.error('🧠 MediatorService: Error enhancing prompt:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          processingTime: Date.now() - startTime
        }
      };
    }
  }

  /**
   * Make intelligent routing decisions about which Worker AI to use
   */
  public async suggestOptimalWorkerAI(
    userPrompt: string,
    availableWorkers: string[]
  ): Promise<MediationResult> {
    console.log('🧠 MediatorService: Suggesting optimal Worker AI from:', availableWorkers);
    
    const startTime = Date.now();
    
    try {
      const systemPrompt = `You are an AI routing expert. Analyze prompts and recommend the best AI system based on their strengths:

Claude: Excellent for analysis, writing, reasoning, ethical discussions
ChatGPT: Great for general tasks, coding, creative writing, problem-solving
Gemini: Strong at research, factual queries, web-connected tasks

Available options: ${availableWorkers.join(', ')}

Return only the name of the recommended AI and a brief reason (max 20 words).
Format: "AI_NAME: reason"`;

      const userContent = `Which AI would be best for this prompt?

"${userPrompt}"

Consider the task type, complexity, and required skills.`;

      const suggestion = await this.callMediatorAI(systemPrompt, userContent);
      
      return {
        success: true,
        result: suggestion,
        metadata: {
          processingTime: Date.now() - startTime,
          confidence: 0.8
        }
      };
    } catch (error) {
      console.error('🧠 MediatorService: Error suggesting Worker AI:', error);
      
      // Fallback to first available worker
      const fallback = `${availableWorkers[0]}: Default selection (mediator unavailable)`;
      
      return {
        success: true,
        result: fallback,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          processingTime: Date.now() - startTime,
          confidence: 0.5
        }
      };
    }
  }

  /**
   * Core method to call the Mediator AI with fallback between OpenRouter and Google AI Studio
   */
  private async callMediatorAI(systemPrompt: string, userContent: string): Promise<string> {
    console.log('🧠 MediatorService: Attempting API call with dual fallback support...');
    
    // Try OpenRouter first (more reliable for consistent API format)
    try {
      const result = await this.callOpenRouterAPI(systemPrompt, userContent);
      console.log('🧠 MediatorService: OpenRouter API call successful');
      return result;
    } catch (openRouterError) {
      console.warn('🧠 MediatorService: OpenRouter failed, trying Google AI Studio fallback:', openRouterError);
      
      // Fallback to Google AI Studio
      try {
        const result = await this.callGoogleAIStudio(systemPrompt, userContent);
        console.log('🧠 MediatorService: Google AI Studio fallback successful');
        return result;
      } catch (googleError) {
        console.error('🧠 MediatorService: Both APIs failed:', { openRouterError, googleError });
        
        // Both APIs failed - throw combined error
        throw new Error(`Both APIs failed - OpenRouter: ${openRouterError instanceof Error ? openRouterError.message : openRouterError}, Google: ${googleError instanceof Error ? googleError.message : googleError}`);
      }
    }
  }

  /**
   * Call OpenRouter API (primary method)
   */
  private async callOpenRouterAPI(systemPrompt: string, userContent: string): Promise<string> {
    const apiKey = OPENROUTER_API_KEY;
    
    if (!apiKey || typeof apiKey !== 'string' || apiKey === 'sk-or-v1-missing-key') {
      throw new Error('Invalid or missing OpenRouter API key');
    }

    const response = await fetch(this.openRouterUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://nexusmind.dev',
        'X-Title': 'NexusMind AI Mediator',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.mediatorModel,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: userContent
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`OpenRouter API request failed: ${response.status} - ${errorBody}`);
    }

    const data = await response.json();
    const result = data.choices[0]?.message?.content;

    if (!result) {
      throw new Error('Invalid response structure from OpenRouter API');
    }

    return result.trim();
  }

  /**
   * Call Google AI Studio API (fallback method)
   */
  private async callGoogleAIStudio(systemPrompt: string, userContent: string): Promise<string> {
    const apiKey = GEMINI_API_KEY;
    
    if (!apiKey || typeof apiKey !== 'string' || apiKey === 'missing-gemini-key') {
      throw new Error('Invalid or missing Google AI Studio API key');
    }

    try {
      const genAI = new GoogleGenAI({ apiKey });
      const model = genAI.models.generateContent;

      // Combine system prompt and user content for Google AI Studio format
      const combinedPrompt = `${systemPrompt}\n\nUser Request:\n${userContent}`;

      const response = await model({
        model: "gemini-2.0-flash-exp",
        contents: combinedPrompt,
      });

      if (!response.text) {
        throw new Error('No response text from Google AI Studio');
      }

      return response.text.trim();
    } catch (error) {
      throw new Error(`Google AI Studio API call failed: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Generate system prompt for mediated prompt creation
   */
  private getMediatedPromptSystemPrompt(targetWorkerAI: string): string {
    const workerStrengths = {
      'Claude': 'excellent analytical thinking, nuanced understanding, and ethical reasoning',
      'ChatGPT': 'strong problem-solving, coding abilities, and creative thinking',
      'Gemini': 'powerful research capabilities, factual accuracy, and web-connected knowledge'
    };

    return `You are an AI prompt engineer. Your job is to take a user's custom instruction and conversation history to create a single, clear, context-aware prompt for ${targetWorkerAI}.

Target AI Strengths: ${workerStrengths[targetWorkerAI as keyof typeof workerStrengths] || 'general AI capabilities'}

Your task:
1. Analyze the user's custom instruction to understand what they want
2. Review the conversation history to provide relevant context
3. Create one optimized prompt that combines both elements
4. Leverage ${targetWorkerAI}'s specific strengths
5. Make the prompt clear, specific, and actionable

Guidelines:
- Include relevant conversation context to inform the analysis
- Preserve the user's original intent and requirements
- Make the prompt self-contained and complete
- Optimize for ${targetWorkerAI}'s capabilities
- Return ONLY the final prompt, nothing else

**IMPORTANT**: Format your entire response using GitHub Flavored Markdown for readability. Use headings, lists, code blocks, and bold text where appropriate.`;
  }

  /**
   * Format context for mediation
   */
  private formatContextForMediation(
    userInstruction: string,
    conversationHistory: string
  ): string {
    return `Create an optimized prompt using this information:

USER'S CUSTOM INSTRUCTION:
${userInstruction}

CONVERSATION HISTORY:
${conversationHistory}

Generate a single, context-aware prompt that combines the user's instruction with the relevant conversation context. The prompt should be ready to send directly to the target AI.`;
  }

  /**
   * Generate fallback mediated prompt when Mediator AI is unavailable
   */
  private generateFallbackMediatedPrompt(
    userInstruction: string,
    conversationHistory: string
  ): string {
    console.log('🧠 MediatorService: Using fallback mediated prompt');
    
    return `${userInstruction}

Context from conversation:
${conversationHistory}

Please provide your analysis based on the above instruction and context.`;
  }
}

export default new MediatorService();