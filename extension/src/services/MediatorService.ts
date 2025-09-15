/**
 * MediatorService.ts
 * 
 * The "Brain" of the NexusMind extension. This service handles all intelligent tasks:
 * - Generating meta-prompts for Worker AIs
 * - Summarizing conversations
 * - Enhancing user prompts
 * - Making intelligent routing decisions
 * 
 * This service uses the Gemini Flash API as the central intelligence mediator.
 */

import { OPENROUTER_API_KEY } from '../lib/constants';

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
   * Generate an intelligent meta-prompt for a Worker AI to analyze a conversation
   * This is the core mediation task - turning raw conversation into targeted analysis requests
   */
  public async generateMetaPrompt(
    role: string,
    userPrompt: string,
    primaryResponse: string,
    targetWorkerAI: string
  ): Promise<MediationResult> {
    console.log('🧠 MediatorService: Generating meta-prompt for role:', role, 'Target AI:', targetWorkerAI);
    
    const startTime = Date.now();
    
    try {
      const systemPrompt = this.getMetaPromptSystemPrompt(role, targetWorkerAI);
      const userContent = this.formatConversationForMetaPrompt(userPrompt, primaryResponse, role);

      const analysis = await this.callMediatorAI(systemPrompt, userContent);
      
      const processingTime = Date.now() - startTime;
      
      console.log(`🧠 MediatorService: Meta-prompt generated successfully in ${processingTime}ms`);
      console.log(`🧠 MediatorService: Preview: "${analysis.substring(0, 100)}..."`);
      
      return {
        success: true,
        result: analysis,
        metadata: {
          processingTime,
          confidence: 0.95 // High confidence for meta-prompt generation
        }
      };
    } catch (error) {
      console.error('🧠 MediatorService: Error generating meta-prompt:', error);
      
      // Provide an intelligent fallback meta-prompt
      const fallbackPrompt = this.generateFallbackMetaPrompt(role, userPrompt, primaryResponse);
      
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
   * Core method to call the Mediator AI (Gemini Flash)
   */
  private async callMediatorAI(systemPrompt: string, userContent: string): Promise<string> {
    const apiKey = OPENROUTER_API_KEY;
    
    if (!apiKey || typeof apiKey !== 'string') {
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
        temperature: 0.7, // Balanced creativity and consistency
        max_tokens: 1000 // Reasonable limit for mediation tasks
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`API request failed: ${response.status} - ${errorBody}`);
    }

    const data = await response.json();
    const result = data.choices[0]?.message?.content;

    if (!result) {
      throw new Error('Invalid response structure from Mediator AI');
    }

    return result.trim();
  }

  /**
   * Generate system prompt for meta-prompt creation
   */
  private getMetaPromptSystemPrompt(role: string, targetWorkerAI: string): string {
    const roleInstructions = {
      'Critic': 'critically analyze and identify potential issues, biases, or improvements',
      'Fact-Checker': 'verify accuracy, check claims, and identify potential misinformation',
      'Alternative View': 'provide different perspectives, contrarian views, or alternative approaches',
      'Developer': 'analyze from a technical/coding perspective, suggest improvements',
      'Analyst': 'provide detailed analysis, break down complex topics, identify patterns'
    };

    const workerStrengths = {
      'Claude': 'excellent analytical thinking and nuanced understanding',
      'ChatGPT': 'strong problem-solving and general knowledge',
      'Gemini': 'powerful research capabilities and factual accuracy'
    };

    return `You are a meta-prompt generator for AI coordination. Create intelligent prompts that leverage ${targetWorkerAI}'s strengths (${workerStrengths[targetWorkerAI as keyof typeof workerStrengths] || 'general capabilities'}).

Role: The target AI should ${roleInstructions[role as keyof typeof roleInstructions] || 'analyze'}.

Create a clear, specific prompt that:
1. Explains the role and perspective to adopt
2. Provides the conversation context  
3. Asks for specific analysis based on the role
4. Leverages the target AI's strengths
5. Requests actionable insights

Keep the meta-prompt focused and effective.`;
  }

  /**
   * Format conversation data for meta-prompt generation
   */
  private formatConversationForMetaPrompt(
    userPrompt: string,
    primaryResponse: string,
    role: string
  ): string {
    return `Create a meta-prompt for this conversation analysis:

USER'S QUESTION:
${userPrompt}

PRIMARY AI'S RESPONSE:
${primaryResponse}

TARGET ROLE: ${role}

Generate a single, well-crafted prompt that will guide another AI to provide valuable ${role.toLowerCase()} analysis of this conversation.`;
  }

  /**
   * Generate fallback meta-prompt when Mediator AI is unavailable
   */
  private generateFallbackMetaPrompt(
    role: string,
    userPrompt: string,
    primaryResponse: string
  ): string {
    console.log('🧠 MediatorService: Using fallback meta-prompt for role:', role);
    
    const roleTemplates = {
      'Critic': 'As a critical analyst, examine the following AI response for potential issues, biases, missing information, or areas that could be improved. Be constructive and specific in your critique.',
      'Fact-Checker': 'As a fact-checker, analyze the following AI response for accuracy. Identify any claims that should be verified, potential misinformation, or statements that need additional sources.',
      'Alternative View': 'As a perspective analyst, provide alternative viewpoints or different approaches to the topic discussed in the following AI response. Consider contrarian views and unexplored angles.',
      'Developer': 'As a technical reviewer, analyze the following response from a developer\'s perspective. Focus on code quality, best practices, potential bugs, and technical accuracy.',
      'Analyst': 'As a detailed analyst, provide deeper analysis of the following response. Break down complex topics, identify patterns, and offer additional insights.'
    };

    const template = roleTemplates[role as keyof typeof roleTemplates] || 
                    'As an AI assistant, provide thoughtful analysis of the following response.';

    return `${template}

Original User Question:
${userPrompt}

AI Response to Analyze:
${primaryResponse}

Your Analysis:`;
  }
}

export default new MediatorService();