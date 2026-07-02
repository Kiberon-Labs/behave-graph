import type { IConversationService } from './abstractions/IConversationService.js';
import type { IAICredentials } from './abstractions/IAICredentials.js';

/**
 * Inject the conversation service + credential resolver as graph dependencies,
 * so AI nodes can reach them via `graph.getDependency(...)` , the same pattern
 * the scene package uses for `IScene`.
 */
declare module '@kiberon-labs/behave-graph' {
  interface Dependencies {
    IConversationService: IConversationService;
    IAICredentials: IAICredentials;
  }
}

export * from './abstractions/types.js';
export * from './abstractions/IConversationService.js';
export * from './abstractions/IAICredentials.js';
export * from './providers/index.js';
export * from './values/index.js';
export * from './nodes/index.js';
export * from './runtime/ConversationRuntime.js';
export * from './registerAIProfile.js';
