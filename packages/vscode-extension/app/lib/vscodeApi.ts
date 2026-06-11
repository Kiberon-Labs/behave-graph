/**
 * Singleton wrapper for VSCode API
 * The VS Code API can only be acquired once per webview
 */

let vscodeApi: ReturnType<typeof acquireVsCodeApi> | null = null;

export function getVSCodeApi() {
  if (!vscodeApi) {
    vscodeApi = acquireVsCodeApi();
  }
  return vscodeApi;
}

/**
 * Expose the VSCode API globally to prevent duplicate acquisition
 * This allows packages in node_modules to access the already-acquired instance
 */
if (typeof window !== 'undefined') {
  // Store reference before acquiring
  const originalAcquire = (window as any).acquireVsCodeApi;

  // Override acquireVsCodeApi to return the singleton
  (window as any).acquireVsCodeApi = function () {
    if (vscodeApi) {
      return vscodeApi;
    }
    // First call - use original function
    vscodeApi = originalAcquire();
    return vscodeApi;
  };
}
