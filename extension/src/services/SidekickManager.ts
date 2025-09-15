/**
 * SidekickManager.ts
 * 
 * Orchestrates Worker AI interactions for the Sidekick feature.
 * This is the "coordinator" that manages:
 * - Detecting new AI responses in real-time
 * - Coordinating with the Mediator for intelligent prompts
 * - Managing Worker AI execution through background scripts
 * - Displaying results in the UI
 * 
 * The actual "intelligence" has been moved to MediatorService.
 */

import type { SidekickConfig, LegacySidekickConfig } from '../types';
import { getPlatformName, getResponseSelectors } from '../content-scripts/dom_utils';
import ContextManager from './ContextManager';
import MediatorService from './MediatorService';

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

  /**
   * Start the Sidekick with the given configuration
   * Handles both legacy and modern config formats
   */
  public start(config: SidekickConfig | LegacySidekickConfig) {
    if (this.isSidekickActive) {
      this.stop();
    }

    // Handle legacy config migration
    const modernConfig = this.migrateConfigIfNeeded(config);

    this.isSidekickActive = true;
    this.currentConfig = modernConfig;
    ContextManager.initializeContext(modernConfig.workerAI, modernConfig.role);
    
    console.log('🤖 SidekickManager: Started with config:', {
      workerAI: modernConfig.workerAI,
      role: modernConfig.role,
      useMediator: modernConfig.useMediator
    });

    if (this.platformName === 'Unknown') {
      console.error('🤖 SidekickManager: Cannot start, unknown platform.');
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
    console.log('🤖 SidekickManager: Stopped.');
  }

  /**
   * Migrate legacy config format to modern format
   * Legacy: { platform: 'Claude', role: 'Critic', enabled: true }
   * Modern: { workerAI: 'Claude', role: 'Critic', enabled: true, useMediator: true }
   */
  private migrateConfigIfNeeded(config: SidekickConfig | LegacySidekickConfig): SidekickConfig {
    // Check if this is a legacy config (has 'platform' instead of 'workerAI')
    if ('platform' in config && !('workerAI' in config)) {
      console.log('🔄 SidekickManager: Migrating legacy config format');
      const legacyConfig = config as LegacySidekickConfig;
      return {
        enabled: legacyConfig.enabled,
        workerAI: legacyConfig.platform,
        role: legacyConfig.role,
        useMediator: true, // Default to using mediator for migrated configs
      };
    }
    
    // Modern config, ensure it has all required fields
    const modernConfig = config as SidekickConfig;
    return {
      enabled: modernConfig.enabled,
      workerAI: modernConfig.workerAI,
      role: modernConfig.role,
      useMediator: modernConfig.useMediator !== false, // Default to true if undefined
    };
  }

  /**
   * Start observing for new AI responses on the current platform
   */
  private startObserver() {
    const responseSelector = getResponseSelectors(this.platformName).join(', ');
    if (!responseSelector) {
      console.error(`🤖 SidekickManager: No response selectors found for platform: ${this.platformName}`);
      return;
    }

    console.log(`🤖 SidekickManager: Observing for new responses with selectors: "${responseSelector}"`);

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

  /**
   * Find the most recent user prompt on the current platform
   */
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
        '[data-testid="user-message"]',
        '[data-is-streaming="false"] .font-user-message',
        '.human-message',
        '[class*="user"]'
      ],
      'Gemini': [
        '[data-test-id="user-message"]',
        '.user-message',
        '[class*="user"]',
        '[role="presentation"] + [role="presentation"]'
      ]
    };

    const selectors = userSelectors[platform] || userSelectors['ChatGPT'];
    
    for (const selector of selectors) {
      try {
        const userElements = document.querySelectorAll(selector);
        if (userElements && userElements.length > 0) {
          const lastUserElement = userElements[userElements.length - 1] as HTMLElement;
          const promptText = lastUserElement.innerText?.trim();
          
          if (promptText && promptText.length > 0) {
            console.log(`🤖 SidekickManager: Found user prompt: "${promptText.substring(0, 50)}${promptText.length > 50 ? '...' : ''}"`);
            return promptText;
          }
        }
      } catch (e) {
        console.log(`🤖 SidekickManager: Error with selector "${selector}":`, e);
      }
    }
    
    console.warn('🤖 SidekickManager: Could not find user prompt');
    return "User prompt not found";
  }

  /**
   * Process a newly detected AI response
   * This is the core coordination logic
   */
  private async processLatestMessage(botResponseElement: HTMLElement) {
    if (!this.isSidekickActive || !this.currentConfig) return;

    console.log('🤖 SidekickManager: Processing latest message with new multi-step flow...');
    
    // Mark as processing to prevent duplicate processing
    this.processingNodes.add(botResponseElement);

    try {
      // STEP 1: Extract conversation context (unchanged)
      const botResponse = botResponseElement.innerText?.trim();
      
      if (!botResponse || botResponse.length < 3) {
        console.warn('🤖 SidekickManager: Empty or too short response text, skipping analysis');
        return;
      }

      const userPrompt = this.findUserPrompt();
      
      if (!userPrompt || userPrompt === "User prompt not found" || userPrompt.length < 3) {
        console.warn('🤖 SidekickManager: Could not find user prompt, skipping analysis');
        return;
      }

      console.log(`🤖 SidekickManager: Context - User: "${userPrompt.substring(0, 50)}..." AI: "${botResponse.substring(0, 50)}..."`);

      // STEP 2: Store conversation context (unchanged)
      ContextManager.addUserMessage(userPrompt);
      ContextManager.addPrimaryResponseMessage(botResponse);

      // STEP 3: Generate intelligent meta-prompt via MediatorService
      let intelligentMetaPrompt: string;
      
      if (this.currentConfig.useMediator) {
        console.log('🧠 SidekickManager: Calling MediatorService for intelligent meta-prompt generation...');
        
        const mediationResult = await MediatorService.generateMetaPrompt(
          this.currentConfig.role,
          userPrompt,
          botResponse,
          this.currentConfig.workerAI
        );
        
        if (mediationResult.success && mediationResult.result) {
          intelligentMetaPrompt = mediationResult.result;
          console.log(`🧠 SidekickManager: Mediator generated intelligent prompt (confidence: ${mediationResult.metadata?.confidence})`);
        } else {
          console.warn('🧠 SidekickManager: Mediator failed, falling back to template');
          intelligentMetaPrompt = this.generateTemplatePrompt(userPrompt, botResponse);
        }
      } else {
        console.log('📝 SidekickManager: Using template-based prompt generation (Mediator disabled)');
        intelligentMetaPrompt = this.generateTemplatePrompt(userPrompt, botResponse);
      }

      console.log(`🤖 SidekickManager: Generated meta-prompt: "${intelligentMetaPrompt.substring(0, 100)}..."`);

      // STEP 4: Send EXECUTE_SIDEKICK_TASK message to background script
      console.log(`🚀 SidekickManager: Sending EXECUTE_SIDEKICK_TASK to background for ${this.currentConfig.workerAI}...`);
      
      const message = {
        type: 'EXECUTE_SIDEKICK_TASK',
        platform: this.currentConfig.workerAI,
        prompt: intelligentMetaPrompt,
        metadata: {
          originalUserPrompt: userPrompt,
          primaryResponse: botResponse,
          role: this.currentConfig.role,
          usedMediator: this.currentConfig.useMediator,
          sourceTabId: undefined // Will be set by background script
        }
      };

      // Use chrome.runtime.sendMessage with promise-based approach
      const executeTask = () => {
        return new Promise((resolve, reject) => {
          chrome.runtime.sendMessage(message, (response) => {
            if (chrome.runtime.lastError) {
              reject(chrome.runtime.lastError);
            } else {
              resolve(response);
            }
          });
        });
      };

      try {
        const response = await executeTask() as any;
        
        if (response && response.success) {
          console.log('✅ SidekickManager: Worker AI analysis received from background script');
          
          // Store the analysis from the Worker AI
          ContextManager.addSidekickResponseMessage(response.analysis);

          // Dispatch event to update the UI
          document.dispatchEvent(new CustomEvent('nexusmind-sidekick-response', {
            detail: {
              targetElement: botResponseElement,
              analysis: response.analysis,
              metadata: {
                workerAI: this.currentConfig.workerAI,
                role: this.currentConfig.role,
                usedMediator: this.currentConfig.useMediator,
                executionTime: response.executionTime
              }
            }
          }));

          console.log('🎉 SidekickManager: Multi-step analysis complete and UI updated');
        } else {
          console.error('❌ SidekickManager: Worker AI task execution failed:', response?.error);
          
          // Dispatch error event for UI feedback
          document.dispatchEvent(new CustomEvent('nexusmind-sidekick-error', {
            detail: {
              targetElement: botResponseElement,
              error: response?.error || 'Unknown error during Worker AI execution',
              metadata: {
                workerAI: this.currentConfig.workerAI,
                role: this.currentConfig.role
              }
            }
          }));
        }
      } catch (error) {
        console.error('❌ SidekickManager: Error communicating with background script:', error);
        
        // Dispatch error event
        document.dispatchEvent(new CustomEvent('nexusmind-sidekick-error', {
          detail: {
            targetElement: botResponseElement,
            error: `Communication error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            metadata: {
              workerAI: this.currentConfig.workerAI,
              role: this.currentConfig.role
            }
          }
        }));
      }

    } catch (error) {
      console.error('❌ SidekickManager: Critical error during multi-step analysis:', error);
    } finally {
      // Clean up processing state after a delay
      setTimeout(() => this.processingNodes.delete(botResponseElement), 2000);
    }
  }

  /**
   * UTILITY METHODS FOR UI INTEGRATION
   */

  /**
   * Check if the Mediator is enabled in current configuration
   */
  public isMediatorEnabled(): boolean {
    return this.currentConfig?.useMediator === true;
  }

  /**
   * Get current Sidekick configuration
   */
  public getCurrentConfig(): SidekickConfig | null {
    return this.currentConfig;
  }

  /**
   * Check if Sidekick is currently active
   */
  public isActive(): boolean {
    return this.isSidekickActive;
  }

  /**
   * Get platform name for current tab
   */
  public getPlatformName(): string {
    return this.platformName;
  }

  /**
   * NEW MEDIATOR-POWERED FEATURES
   */

  /**
   * Generate a conversation summary using the MediatorService
   * This can be called by UI components (e.g., "Summarize" button)
   */
  public async generateConversationSummary(): Promise<{success: boolean; summary?: string; error?: string}> {
    try {
      console.log('📊 SidekickManager: Generating conversation summary via MediatorService...');
      
      const conversationHistory = ContextManager.getConversationHistory();
      
      if (!conversationHistory || conversationHistory.length === 0) {
        return {
          success: false,
          error: 'No conversation history available to summarize'
        };
      }

      // Convert ContextItem array to formatted string
      const conversationText = conversationHistory.map(item => {
        const timestamp = new Date(item.timestamp).toLocaleTimeString();
        const typeLabel = item.type === 'user' ? 'User' : 
                         item.type === 'primary' ? 'AI' : 'Sidekick';
        return `[${timestamp}] ${typeLabel}: ${item.content}`;
      }).join('\n\n');

      const summaryResult = await MediatorService.summarizeConversation(
        conversationText, 
        'Identify key topics, decisions, and action items from this AI conversation'
      );
      
      if (summaryResult.success && summaryResult.result) {
        console.log('📊 SidekickManager: Conversation summary generated successfully');
        
        // Dispatch event for UI components to handle
        document.dispatchEvent(new CustomEvent('nexusmind-summary-generated', {
          detail: {
            summary: summaryResult.result,
            conversationLength: conversationHistory.length,
            metadata: summaryResult.metadata
          }
        }));

        return {
          success: true,
          summary: summaryResult.result
        };
      } else {
        console.error('❌ SidekickManager: Conversation summary generation failed:', summaryResult.error);
        return {
          success: false,
          error: summaryResult.error || 'Unknown error during summary generation'
        };
      }
    } catch (error) {
      console.error('❌ SidekickManager: Error generating conversation summary:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Enhance a user's prompt using the MediatorService
   * This can be called by UI components (e.g., "Enhance" button)
   */
  public async enhancePrompt(originalPrompt: string): Promise<{success: boolean; enhancedPrompt?: string; error?: string}> {
    try {
      console.log('✨ SidekickManager: Enhancing prompt via MediatorService...');
      
      if (!originalPrompt || originalPrompt.trim().length === 0) {
        return {
          success: false,
          error: 'No prompt provided to enhance'
        };
      }

      const enhancementResult = await MediatorService.enhancePrompt(originalPrompt);
      
      if (enhancementResult.success && enhancementResult.result) {
        console.log('✨ SidekickManager: Prompt enhancement completed successfully');
        
        // Dispatch event for UI components to handle
        document.dispatchEvent(new CustomEvent('nexusmind-prompt-enhanced', {
          detail: {
            originalPrompt: originalPrompt,
            enhancedPrompt: enhancementResult.result,
            metadata: enhancementResult.metadata
          }
        }));

        return {
          success: true,
          enhancedPrompt: enhancementResult.result
        };
      } else {
        console.error('❌ SidekickManager: Prompt enhancement failed:', enhancementResult.error);
        return {
          success: false,
          error: enhancementResult.error || 'Unknown error during prompt enhancement'
        };
      }
    } catch (error) {
      console.error('❌ SidekickManager: Error enhancing prompt:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get optimal Worker AI suggestion from MediatorService
   * This can help users choose the best Worker AI for their task
   */
  public async suggestOptimalWorkerAI(userPrompt: string, availableWorkers?: string[]): Promise<{success: boolean; suggestion?: string; error?: string}> {
    try {
      console.log('🎯 SidekickManager: Getting optimal Worker AI suggestion via MediatorService...');
      
      if (!userPrompt || userPrompt.trim().length === 0) {
        return {
          success: false,
          error: 'No prompt provided for AI suggestion'
        };
      }

      // Default available workers if not provided
      const workers = availableWorkers || ['Claude', 'ChatGPT', 'Gemini'];
      
      const suggestionResult = await MediatorService.suggestOptimalWorkerAI(userPrompt, workers);
      
      if (suggestionResult.success && suggestionResult.result) {
        console.log('🎯 SidekickManager: Optimal Worker AI suggestion generated successfully');
        
        // Dispatch event for UI components to handle
        document.dispatchEvent(new CustomEvent('nexusmind-ai-suggested', {
          detail: {
            userPrompt: userPrompt,
            suggestion: suggestionResult.result,
            availableWorkers: workers,
            metadata: suggestionResult.metadata
          }
        }));

        return {
          success: true,
          suggestion: suggestionResult.result
        };
      } else {
        console.error('❌ SidekickManager: Worker AI suggestion failed:', suggestionResult.error);
        return {
          success: false,
          error: suggestionResult.error || 'Unknown error during AI suggestion'
        };
      }
    } catch (error) {
      console.error('❌ SidekickManager: Error suggesting optimal Worker AI:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Generate a basic template-based prompt when Mediator is disabled
   * This provides fallback functionality without requiring API calls
   */
  private generateTemplatePrompt(userPrompt: string, primaryResponse: string): string {
    const roleTemplates = {
      'Critic': 'As a critical analyst, examine the following AI response for potential issues, biases, missing information, or areas that could be improved. Be constructive and specific in your critique.',
      'Fact-Checker': 'As a fact-checker, analyze the following AI response for accuracy. Identify any claims that should be verified, potential misinformation, or statements that need additional sources.',
      'Alternative View': 'As a perspective analyst, provide alternative viewpoints or different approaches to the topic discussed in the following AI response. Consider contrarian views and unexplored angles.',
      'Developer': 'As a technical reviewer, analyze the following response from a developer\'s perspective. Focus on code quality, best practices, potential bugs, and technical accuracy.',
      'Analyst': 'As a detailed analyst, provide deeper analysis of the following response. Break down complex topics, identify patterns, and offer additional insights.'
    };

    const template = roleTemplates[this.currentConfig!.role] || 
                    'As an AI assistant, provide thoughtful analysis of the following response.';

    return `${template}

Original User Question:
${userPrompt}

AI Response to Analyze:
${primaryResponse}

Your Analysis:`;
  }
}

export default SidekickManager;


