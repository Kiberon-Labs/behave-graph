// The TTS boundary. Providers are swappable adapters behind this minimal
// interface; adding a provider = one file implementing `TtsProvider` + a case
// in the factory (index.ts). Raw fetch, no vendor SDKs.

export interface TtsRequest {
  /** Scene id  used only for error messages. */
  id: string;
  /** The text to speak. */
  text: string;
}

export interface TtsResult {
  audio: Uint8Array;
  format: 'mp3';
}

export interface TtsProvider {
  readonly name: string;
  synthesize(req: TtsRequest): Promise<TtsResult>;
}
