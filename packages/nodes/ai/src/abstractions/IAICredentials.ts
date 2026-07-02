/**
 * Host-provided resolver for AI provider API keys.
 *
 * The graph only ever carries a non-secret *reference* (a provider kind, or a
 * named secret via an `ai/provider` node's `credentialRef`). The actual key is
 * resolved here, at the API-call boundary, from whatever the host trusts , env
 * vars, a secret manager, an OS keychain , so keys never end up in node params
 * or saved graph JSON.
 *
 * Injected into the execution registry's `dependencies` (like `IScene` /
 * `IConversationService`) and handed to the {@link ConversationRuntime}.
 */
export interface IAICredentials {
  /**
   * Resolve an API key by reference. Returns `undefined` if the reference is
   * unknown (the request will then fail with the provider's auth error).
   */
  getApiKey(ref: string): string | undefined;
}
