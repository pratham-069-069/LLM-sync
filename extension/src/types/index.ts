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
}

/**
 * Settings for the AI Sidekick feature.
 */
export interface SidekickSettings {
  /** Whether the sidekick is enabled by default. */
  enabled: boolean;
  /** The default AI platform to use for the sidekick. */
  platform: 'Claude' | 'ChatGPT' | 'Gemini';
  /** The default role for the sidekick to adopt. */
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
 * Defines the structure of all data stored in chrome.storage.local.
 */
export interface ExtensionStorage {
  'nexusmind-api-key'?: string;
  'nexusmind-highlights'?: Highlight[];
  'nexusmind-sidekick'?: SidekickSettings;
  'nexusmind-templates'?: PromptTemplate[];
}