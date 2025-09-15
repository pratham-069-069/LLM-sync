/**
 * Core type definitions for the NexusMind extension.
 */

/**
 * Represents a single highlighted text segment.
 */
export interface Highlight {
  /** A unique identifier for the highlight. */
  id: string;
  /** The URL of the page where the highlight was made. */
  url: string;
  /** The highlighted text content. */
  text: string;
  /** The color of the highlight. */
  color: 'yellow' | 'green' | 'blue' | 'red' | 'purple';
  /** The timestamp when the highlight was created. */
  timestamp: number;
  /** The AI platform where the highlight was made. */
  platform: string;
}

/**
 * Configuration for the AI Sidekick feature.
 * Separates the Mediator (intelligence/brain) from the Worker (analysis executor).
 */
export interface SidekickConfig {
  /** Whether the sidekick is enabled. */
  enabled: boolean;
  /** The Worker AI platform to perform the analysis (the "doer"). */
  workerAI: 'Claude' | 'ChatGPT' | 'Gemini';
  /** The role for the Worker AI to adopt during analysis. */
  role: 'Critic' | 'Fact-Checker' | 'Alternative View' | 'Developer' | 'Analyst';
  /** Whether to use the Mediator (Gemini) for intelligent meta-prompt generation. */
  useMediator: boolean;
}

/**
 * DEPRECATED: Legacy platform field for backward compatibility
 * @deprecated Use workerAI instead
 */
export interface LegacySidekickConfig {
  enabled: boolean;
  platform: 'Claude' | 'ChatGPT' | 'Gemini';
  role: 'Critic' | 'Fact-Checker' | 'Alternative View';
}

/**
 * Represents a custom slash command for prompt enhancement.
 */
export interface PromptTemplate {
  /** The command to type (e.g., "summarize"). */
  command: string;
  /** The full prompt template to be inserted. */
  template: string;
  /** A short description of what the command does. */
  description: string;
}

/**
 * Represents a saved text snippet from AI responses.
 */
export interface Snippet {
  /** A unique identifier for the snippet. */
  id: string;
  /** The snippet text content. */
  text: string;
  /** The timestamp when the snippet was saved. */
  timestamp: number;
  /** The URL where the snippet was saved from. */
  url: string;
  /** The AI platform where the snippet originated. */
  platform: string;
}

/**
 * Defines the structure of all data stored in chrome.storage.local.
 */
export interface ExtensionStorage {
  'nexusmind-api-key'?: string;
  'nexusmind-highlights'?: Highlight[];
  'nexusmind-sidekick-config'?: SidekickConfig;
  'nexusmind-templates'?: PromptTemplate[];
  'nexusmind-snippets'?: Snippet[];
}