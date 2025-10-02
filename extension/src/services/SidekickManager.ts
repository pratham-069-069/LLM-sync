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
  private isSidekickActive: boolean = false;
  private currentConfig: SidekickConfig | null = null;
  private platformName: string;
  private processingNodes: WeakSet<HTMLElement> = new WeakSet();
  private processedElements: WeakSet<HTMLElement> = new WeakSet(); // Track processed response elements
  private observer: MutationObserver | null = null; // For automatic response detection
  // Better throttling to prevent infinite loops
  private isProcessing: boolean = false; // Track if currently processing
  private lastProcessTime: number = 0;
  private readonly PROCESS_THROTTLE_MS = 5000; // 5 seconds between processing attempts
  private processedMessageHashes: Set<string> = new Set(); // Track processed messages by content hash
  private _initialized: boolean = false;

  private constructor() {
    this.platformName = getPlatformName();
  }

  public static getInstance(): SidekickManager {
    if (!SidekickManager.instance) {
      SidekickManager.instance = new SidekickManager();
      SidekickManager.instance.initialize();
    }
    return SidekickManager.instance;
  }

  public get isInitialized(): boolean {
    return this._initialized;
  }

  public initialize(): void {
    if (this._initialized) return;
    
    // Basic initialization - mark as initialized
    this._initialized = true;
    console.log('🤖 SidekickManager: Instance initialized');
  }

  public configure(config: SidekickConfig | LegacySidekickConfig): void {
    console.log('🤖 SidekickManager: Configuring with:', config);
    
    // Handle legacy config migration
    const modernConfig = this.migrateConfigIfNeeded(config);
    this.currentConfig = modernConfig;
    this._initialized = true;
    
    // Set as active but don't start automatic analysis
    this.isSidekickActive = true;
    
    // Initialize context for the worker AI
    ContextManager.initializeContext(modernConfig.workerAI, 'Sidekick');
    
    // Important: We're explicitly configuring, but NOT starting automatic analysis
    // This prevents the loop issue after reload
    console.log('🤖 SidekickManager: Configuration set without starting automatic analysis');
  }

  /**
   * Initialize the Sidekick with the given configuration (no auto-observer)
   * Handles both legacy and modern config formats
   */
  public async start(config: SidekickConfig | LegacySidekickConfig) {
    if (this.isSidekickActive) {
      this.stop();
    }

    // Handle legacy config migration
    const modernConfig = this.migrateConfigIfNeeded(config);

    this.isSidekickActive = true;
    this.currentConfig = modernConfig;
    await ContextManager.initializeContext(modernConfig.workerAI, 'Sidekick');
    
    console.log('🤖 SidekickManager: Initialized with config (manual mode):', {
      workerAI: modernConfig.workerAI,
      customPrompt: modernConfig.customPrompt.substring(0, 50) + '...',
      useMediator: modernConfig.useMediator
    });

    if (this.platformName === 'Unknown') {
      console.error('🤖 SidekickManager: Cannot start, unknown platform.');
      return;
    }

    console.log('🤖 SidekickManager: Ready for manual analysis requests');
    
    // Set up MutationObserver for automatic detection of new responses
    this.setupMutationObserver();
  }

  /**
   * Set up MutationObserver to automatically detect new AI responses
   */
  private setupMutationObserver() {
    // Stop any existing observer
    if (this.observer) {
      this.observer.disconnect();
    }

    this.observer = new MutationObserver(this.checkForNewResponse);
    
    // Observe the document body for any changes
    const targetNode = document.body;
    const config = { 
      childList: true, 
      subtree: true,
      attributes: false,
      characterData: false
    };

    this.observer.observe(targetNode, config);
    console.log('🤖 SidekickManager: MutationObserver started for automatic response detection');
  }

  /**
   * Check for new AI responses on the page and process the latest one
   * This function is called by MutationObserver on DOM changes
   */
  private checkForNewResponse = () => {
    if (!this.isSidekickActive || !this.currentConfig || !this.currentConfig.enabled) {
      return;
    }

    const platform = getPlatformName();
    const selectors = getResponseSelectors(platform);
    
    if (!selectors || selectors.length === 0) {
      console.warn(`🤖 SidekickManager: No response selectors found for platform: ${platform}`);
      return;
    }

    try {
      // CORE FIX: Use querySelectorAll to get ALL response elements, then select the last one
      const allResponseElements = document.querySelectorAll<HTMLElement>(selectors.join(', '));
      
      if (allResponseElements.length === 0) {
        return; // No responses found
      }

      // Select the VERY LAST element from the list (most recent response)
      const latestResponseElement = allResponseElements[allResponseElements.length - 1];
      
      if (!latestResponseElement) {
        return;
      }

      // Check if we've already processed this specific element
      if (this.processedElements.has(latestResponseElement)) {
        return; // Already processed this element
      }

      // Verify the element has actual content
      const responseText = latestResponseElement.textContent?.trim();
      if (!responseText || responseText.length < 10) {
        return; // Skip empty or very short responses
      }

      console.log('🤖 SidekickManager: New latest response detected, processing...', {
        platform,
        elementTag: latestResponseElement.tagName,
        contentLength: responseText.length,
        contentPreview: responseText.substring(0, 50) + '...'
      });

      // Mark this element as processed
      this.processedElements.add(latestResponseElement);
      
      // Process the latest response
      this.handleNewResponse(latestResponseElement);

    } catch (error) {
      console.error('🤖 SidekickManager: Error in checkForNewResponse:', error);
    }
  };

  /**
   * Handle processing of a newly detected response
   */
  private async handleNewResponse(responseElement: HTMLElement) {
    try {
      console.log('🤖 SidekickManager: Handling new response element');
      await this.processLatestMessage(responseElement);
    } catch (error) {
      console.error('🤖 SidekickManager: Error handling new response:', error);
    }
  }

  public stop() {
    this.isSidekickActive = false;
    this.currentConfig = null;
    // Clear processed message hashes and reset processing state
    this.processedMessageHashes.clear();
    this.isProcessing = false;
    this.lastProcessTime = 0;
    
    // Stop MutationObserver
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
      console.log('🤖 SidekickManager: MutationObserver stopped');
    }
    
    console.log('🤖 SidekickManager: Stopped and reset all processing state.');
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
      
      // Convert old role to custom prompt
      const roleToPromptMap: { [key: string]: string } = {
        'Critic': 'Analyze this response and provide critical feedback on accuracy, completeness, and potential improvements.',
        'Fact-Checker': 'Verify the accuracy of claims in this response and identify any potential misinformation.',
        'Alternative View': 'Provide alternative perspectives or different approaches to the topic discussed in this response.',
        'Developer': 'Analyze this response from a technical/coding perspective and suggest improvements.',
        'Analyst': 'Provide detailed analysis of this response, breaking down complex topics and identifying patterns.'
      };
      
      return {
        enabled: legacyConfig.enabled,
        workerAI: legacyConfig.platform,
        customPrompt: roleToPromptMap[legacyConfig.role] || 'Analyze this response and provide helpful feedback.',
        useMediator: true, // Default to using mediator for migrated configs
      };
    }
    
    // Check if this is an old modern config that still has 'role' instead of 'customPrompt'
    const anyConfig = config as any;
    if ('role' in anyConfig && !('customPrompt' in anyConfig)) {
      console.log('🔄 SidekickManager: Migrating role-based config to custom prompt');
      
      const roleToPromptMap: { [key: string]: string } = {
        'Critic': 'Analyze this response and provide critical feedback on accuracy, completeness, and potential improvements.',
        'Fact-Checker': 'Verify the accuracy of claims in this response and identify any potential misinformation.',
        'Alternative View': 'Provide alternative perspectives or different approaches to the topic discussed in this response.',
        'Developer': 'Analyze this response from a technical/coding perspective and suggest improvements.',
        'Analyst': 'Provide detailed analysis of this response, breaking down complex topics and identifying patterns.'
      };
      
      return {
        enabled: anyConfig.enabled,
        workerAI: anyConfig.workerAI,
        customPrompt: roleToPromptMap[anyConfig.role] || 'Analyze this response and provide helpful feedback.',
        useMediator: anyConfig.useMediator !== false,
      };
    }
    
    // Modern config, ensure it has all required fields
    const modernConfig = config as SidekickConfig;
    return {
      enabled: modernConfig.enabled,
      workerAI: modernConfig.workerAI,
      customPrompt: modernConfig.customPrompt || 'Analyze this response and provide helpful feedback.',
      useMediator: modernConfig.useMediator !== false, // Default to true if undefined
    };
  }

  /**
   * Manually analyze a specific AI response element
   * This replaces the automatic MutationObserver approach
   */
  public async analyzeMessage(botResponseElement: HTMLElement): Promise<{success: boolean; error?: string}> {
    if (!this.isSidekickActive || !this.currentConfig) {
      return {
        success: false,
        error: 'Sidekick is not active or not configured'
      };
    }

    console.log('🤖 SidekickManager: Manual analysis requested');
    
    // Check if already processing this element
    if (this.processingNodes.has(botResponseElement)) {
      return {
        success: false,
        error: 'This message is already being analyzed'
      };
    }

    // Apply throttling
    const now = Date.now();
    if (now - this.lastProcessTime < this.PROCESS_THROTTLE_MS) {
      const waitTime = this.PROCESS_THROTTLE_MS - (now - this.lastProcessTime);
      return {
        success: false,
        error: `Please wait ${Math.ceil(waitTime/1000)} seconds before analyzing another message`
      };
    }

    try {
      await this.processLatestMessage(botResponseElement);
      return { success: true };
    } catch (error) {
      console.error('🤖 SidekickManager: Error in manual analysis:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }


  /**
   * Process a manually triggered AI response analysis
   * This is the core coordination logic for manual mode
   */
  private async processLatestMessage(botResponseElement: HTMLElement) {
    if (!this.isSidekickActive || !this.currentConfig) return;

    // BUG FIX 2: Better processing control to prevent infinite loops
    if (this.isProcessing) {
      console.log('🤖 SidekickManager: Already processing a message, skipping');
      return;
    }

    const now = Date.now();
    if (now - this.lastProcessTime < this.PROCESS_THROTTLE_MS) {
      const waitTime = this.PROCESS_THROTTLE_MS - (now - this.lastProcessTime);
      console.log(`🤖 SidekickManager: Throttled - need to wait ${Math.ceil(waitTime/1000)}s before next processing`);
      return;
    }

    console.log('🤖 SidekickManager: Processing latest message with new multi-step flow...');
    
    // Set processing flags to prevent concurrent processing
    this.isProcessing = true;
    this.processingNodes.add(botResponseElement);
    this.lastProcessTime = now;

    try {
      // STEP 1: Extract conversation context using ContextManager
      const conversationContext = await ContextManager.getContext(this.platformName, botResponseElement);
      
      if (!conversationContext || conversationContext.messages.length === 0) {
        console.warn('🤖 SidekickManager: Could not build context, skipping analysis');
        return;
      }

      // Format conversation history for mediation
      const conversationHistory = conversationContext.messages
        .map((msg: { role: string; content: string }) => `${msg.role.toUpperCase()}: ${msg.content}`)
        .join('\n\n');

      console.log(`🤖 SidekickManager: Context built with ${conversationContext.messages.length} messages`);

      // BUG FIX 2: Check for duplicate content using hash to prevent processing same message multiple times
      const messageHash = this.generateMessageHash(conversationHistory);
      if (this.processedMessageHashes.has(messageHash)) {
        console.log('🤖 SidekickManager: Message already processed (duplicate content), skipping');
        return;
      }

      // Mark this message as processed
      this.processedMessageHashes.add(messageHash);
      
      // Clean up old hashes to prevent memory leaks (keep only last 25)
      if (this.processedMessageHashes.size > 25) {
        const hashesArray = Array.from(this.processedMessageHashes);
        this.processedMessageHashes.clear();
        hashesArray.slice(-15).forEach(hash => this.processedMessageHashes.add(hash));
      }

      // STEP 2: Store conversation context in ContextManager
      await ContextManager.addUserMessage(conversationContext.messages.find((m: { role: string; content: string }) => m.role === 'user')?.content || 'No user message found');
      await ContextManager.addPrimaryResponseMessage(conversationContext.messages.find((m: { role: string; content: string }) => m.role === 'assistant')?.content || 'No assistant response found');

      // STEP 3: Mediate - Generate optimized prompt via MediatorService
      let finalPrompt: string;
      
      if (this.currentConfig.useMediator) {
        console.log('🧠 SidekickManager: Step 1 - Calling MediatorService for prompt optimization...');
        
        const mediationResult = await MediatorService.generateMediatedPrompt(
          this.currentConfig.customPrompt,
          conversationHistory,
          this.currentConfig.workerAI
        );
        
        if (mediationResult.success && mediationResult.result) {
          finalPrompt = mediationResult.result;
          console.log(`🧠 SidekickManager: Step 1 complete - Mediated prompt generated (confidence: ${mediationResult.metadata?.confidence})`);
        } else {
          console.warn('🧠 SidekickManager: Mediation failed, using direct custom prompt');
          finalPrompt = `${this.currentConfig.customPrompt}\n\nContext:\n${conversationHistory}`;
        }
      } else {
        console.log('📝 SidekickManager: Mediation disabled - Using direct custom prompt');
        finalPrompt = `${this.currentConfig.customPrompt}\n\nContext:\n${conversationHistory}`;
      }

      console.log(`🤖 SidekickManager: Final prompt ready: "${finalPrompt.substring(0, 100)}..."`);

      // STEP 4: Execute - Send EXECUTE_SIDEKICK_TASK message to background script
      console.log(`🚀 SidekickManager: Step 2 - Sending EXECUTE_SIDEKICK_TASK to background for ${this.currentConfig.workerAI}...`);
      
      chrome.runtime.sendMessage({
        type: 'EXECUTE_SIDEKICK_TASK',
        platform: this.currentConfig.workerAI,
        prompt: finalPrompt,
        metadata: {
          originalUserPrompt: conversationContext.messages.find((m: { role: string; content: string }) => m.role === 'user')?.content || '',
          primaryResponse: conversationContext.messages.find((m: { role: string; content: string }) => m.role === 'assistant')?.content || '',
          customPrompt: this.currentConfig.customPrompt,
          usedMediator: this.currentConfig.useMediator
        }
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('❌ SidekickManager: Error communicating with background script:', chrome.runtime.lastError);
          
          // BUG FIX 3: Dispatch error event for UI refresh
          this.dispatchUIUpdateEvent('nexusmind-sidekick-error', {
            targetElement: botResponseElement,
            error: `Communication error: ${chrome.runtime.lastError.message}`,
            metadata: {
              workerAI: this.currentConfig?.workerAI || 'unknown',
              customPrompt: this.currentConfig?.customPrompt.substring(0, 50) + '...' || 'unknown'
            }
          });
          return;
        }

        if (response && response.success) {
          console.log('✅ SidekickManager: Worker AI analysis received from background script');
          
          // Store the analysis from the Worker AI
          ContextManager.addSidekickResponseMessage(response.analysis);

          // BUG FIX 3: Dispatch event to update the UI with proper refresh
          this.dispatchUIUpdateEvent('nexusmind-sidekick-response', {
            targetElement: botResponseElement,
            analysis: response.analysis,
            metadata: {
              workerAI: this.currentConfig?.workerAI || 'unknown',
              customPrompt: this.currentConfig?.customPrompt.substring(0, 50) + '...' || 'unknown',
              usedMediator: this.currentConfig?.useMediator || false,
              executionTime: response.executionTime
            }
          });

          console.log('🎉 SidekickManager: Multi-step analysis complete and UI updated');
        } else {
          console.error('❌ SidekickManager: Worker AI task execution failed:', response?.error);
          
          // BUG FIX 3: Dispatch error event for UI feedback with refresh
          this.dispatchUIUpdateEvent('nexusmind-sidekick-error', {
            targetElement: botResponseElement,
            error: response?.error || 'Unknown error during Worker AI execution',
            metadata: {
              workerAI: this.currentConfig?.workerAI || 'unknown',
              customPrompt: this.currentConfig?.customPrompt.substring(0, 50) + '...' || 'unknown'
            }
          });
        }
      });

    } catch (error) {
      console.error('❌ SidekickManager: Critical error during multi-step analysis:', error);
    } finally {
      // BUG FIX 2: Always clear processing flag and clean up
      this.isProcessing = false;
      setTimeout(() => this.processingNodes.delete(botResponseElement), 5000);
    }
  }

  /**
   * UTILITY METHODS FOR UI INTEGRATION
   */

  /**
   * BUG FIX 2: Generate a simple hash for message content to detect duplicates
   */
  private generateMessageHash(message: string): string {
    // Simple hash function for duplicate detection
    let hash = 0;
    const content = message.substring(0, 200); // Use first 200 chars for hash
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }

  /**
   * BUG FIX 3: Enhanced UI event dispatch with proper refresh mechanism
   */
  private dispatchUIUpdateEvent(eventName: string, detail: any) {
    // Dispatch the event
    document.dispatchEvent(new CustomEvent(eventName, { detail }));
    
    // Force UI refresh by triggering a custom refresh event
    setTimeout(() => {
      document.dispatchEvent(new CustomEvent('nexusmind-force-ui-refresh', { 
        detail: { 
          timestamp: Date.now(),
          source: 'SidekickManager' 
        } 
      }));
    }, 100);
  }

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

}

export default SidekickManager;


