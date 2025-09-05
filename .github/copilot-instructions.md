Copilot Instructions for the AI Enhancement Browser Extension
1. Project Overview & Core Mission
Project Name: AI Enhancement Browser Extension (Codename: "NexusMind")

Core Mission: To build a browser extension that acts as an indispensable power-user layer on top of existing AI chatbots (like ChatGPT, Claude, Gemini, etc.). Our goal is to solve the critical user frustrations of reliability, poor user experience, and suboptimal prompting. We are enhancing, not replacing, the user's existing workflow.

Core Value Proposition: We make AI chats more reliable, organized, and effective.

2. Core Technology Stack & Architecture Principles
Framework: Standard Browser Extension (manifest.json, etc.) built with Vite, React, and TypeScript. This allows us to build complex UIs as components for injection into content scripts.

Styling: Tailwind CSS, supplemented with shadcn/ui where appropriate. All injected UI should have a specific class prefix (e.g., nexusmind-) to avoid conflicts with the host page's styles.

DOM Interaction: We will use a root React component injected by our content scripts. All UI will be managed within React, but the initial injection and observation of the host page will require direct DOM manipulation.

Persistence: Use the chrome.storage.local API for storing user data like highlights and settings.

Key Constraint: The "AI Sidekick" feature MUST NOT use official APIs to avoid costs. It will work by programmatically controlling and scraping other chatbot web UIs in the background. This makes our code sensitive to UI changes on the target websites, so selectors must be well-documented and easy to update.

3. Detailed Feature Breakdown & Implementation Logic
Feature 1: Notion-Style Response Highlighting
Goal: Allow users to select and highlight text within AI-generated responses with different colors. These highlights must persist.

Logic:

A content script injects itself into the chatbot page.

Listen for a mouseup event. On text selection, check if the selection is within a valid AI response container.

If valid, render a small, floating React component (the color-picker UI) near the selected text.

When the user clicks a color in the component, wrap the selected range in a <span> element.

The <span> should have a unique ID and a data attribute for the color (e.g., <span id="nexusmind-highlight-123" data-color="yellow">...</span>).

Save the highlight's metadata (conversation URL, unique ID, text content, color) to chrome.storage.local.

On every page load, the content script must read the stored highlights for that URL and re-apply the <span> wrappers to the corresponding text.

Feature 2: AI Sidekick (Formerly "Comparison")
Goal: Allow a user to select a secondary "Sidekick" AI that automatically analyzes every response from the primary AI in a conversation, based on a pre-defined role.

Logic:

The content script injects a "Sidekick Panel" React component onto the page. This panel allows the user to:
a. Toggle the Sidekick feature On/Off.
b. Select a Sidekick AI (e.g., Claude, Gemini).
c. Choose a Role for the Sidekick (e.g., "Fact-Checker", "Critic", "Alternative View").

When Sidekick mode is active, the content script uses a MutationObserver to detect when the primary AI has finished generating a new response.

When a new response appears, the content script scrapes both the original user prompt and the primary AI's new response.

The content script then constructs a detailed "meta-prompt" based on the selected Role. For the "Critic" role, this would be: "Original Prompt: [prompt]. Primary AI Response: [response]. Your Task: Critique the Primary AI Response for clarity, accuracy, and completeness. Suggest improvements."

This meta-prompt is sent to the background.js script via chrome.runtime.sendMessage, with an action like getSidekickResponse.

The background script opens a hidden tab to the selected Sidekick AI, injects the meta-prompt, scrapes the result, and sends it back to the original tab.

The original content script receives the Sidekick's analysis and renders it in a clearly marked React component below the primary AI's response.

Feature 3: Prompt Enhancer
This feature has two parts, both powered by the Gemini Flash free API via OpenRouter.

A. "Enhance Prompt" Button:

Goal: A single-click button to automatically improve a user's prompt.

Logic:

Inject an "Enhance ✨" button (as part of a React component) near the chatbot's text input area.

When clicked, grab the user's current text from the input field.

Send this text to our background script.

The background script makes a fetch call to the OpenRouter API for Gemini Flash.

The prompt we send to Gemini (the "meta-prompt") is critical: "You are a prompt engineering expert. Rewrite the following user prompt to be more detailed, specific, and structured for a large language model. Add context, specify the desired tone, and suggest an output format if applicable. IMPORTANT: Do not answer the user's prompt. Only return the rewritten, enhanced prompt and nothing else."

The background script gets the enhanced prompt back from the API.

It sends this enhanced prompt back to the content script, which then replaces the text in the user's input field. Provide an "undo" option.

B. Slash Commands:

Goal: Allow power users to use quick commands to insert detailed prompt templates.

Logic:

The content script monitors keyup events in the chatbot's input field.

If it detects /, render a small React component as a popup with available commands (e.g., /summarize, /explain, /code).

When a user completes a command (e.g., types /summarize ), replace the command with a pre-defined, detailed prompt template stored locally within the extension. (e.g., "Provide a comprehensive summary of the following text. Start with a one-sentence overview, followed by three key bullet points, and conclude with the main takeaway.").

4. Central Intelligence Layer (Powered by Gemini Flash)
Beyond the core features, we will use the Gemini Flash API as a central "brain" to provide meta-analysis and memory. This layer MUST use the Retrieval-Augmented Generation (RAG) pattern to ensure its responses are grounded in user data and not hallucinated.

Core RAG Workflow:

Retrieve: Before calling the Gemini API, the extension will first retrieve the relevant context (e.g., the full current conversation transcript, a user's saved highlights, or transcripts from previous sessions) from chrome.storage.local.

Augment: This retrieved context will be formatted and inserted directly into a carefully crafted "Grounding Prompt". The prompt will explicitly instruct the AI to base its answer only on the provided information.

Generate: The augmented prompt is sent to the Gemini Flash API to get a reliable, fact-based response.

New Features Enabled by this Layer:

Session Summary: A button that triggers the RAG workflow to summarize the entire current conversation, extracting key topics and action items.

Cross-Session Memory: A feature that allows a user to provide context from previous, related conversations when starting a new chat. The Central AI will use RAG to summarize the selected old chats and generate a starting prompt for the new one.

Highlight Synthesis: An ability to analyze all the text a user has highlighted in a session and perform tasks on it, such as creating a study guide or a to-do list.

By following these instructions, you will help me build this extension feature by feature, keeping our core architectural principles in mind. Focus on clean, modular, and well-commented code, especially for the DOM manipulation parts which are inherently fragile.
