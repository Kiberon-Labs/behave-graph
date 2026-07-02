import { create, type StoreApi } from 'zustand';

/**
 * A user/plugin-defined automatic type conversion: "when connecting a `from`
 * socket to a `to` socket, splice in `nodeType`". `inputKey`/`outputKey` name
 * the converter's value sockets; when omitted they're resolved from the node
 * spec (first non-flow input/output).
 */
export type ConversionRule = {
  from: string;
  to: string;
  nodeType: string;
  inputKey?: string;
  outputKey?: string;
};

export type ConversionStore = {
  conversions: ConversionRule[];
  /** Add (or replace the existing rule for the same from→to pair). */
  registerConversion: (rule: ConversionRule) => void;
  removeConversion: (from: string, to: string) => void;
  setConversions: (rules: ConversionRule[]) => void;
  findConversion: (from: string, to: string) => ConversionRule | undefined;
};

export const conversionStoreFactory = (): StoreApi<ConversionStore> =>
  create<ConversionStore>((set, get) => ({
    conversions: [],
    registerConversion: (rule) =>
      set((s) => ({
        conversions: [
          ...s.conversions.filter(
            (c) => !(c.from === rule.from && c.to === rule.to)
          ),
          rule
        ]
      })),
    removeConversion: (from, to) =>
      set((s) => ({
        conversions: s.conversions.filter(
          (c) => !(c.from === from && c.to === to)
        )
      })),
    setConversions: (conversions) => set({ conversions: [...conversions] }),
    findConversion: (from, to) =>
      get().conversions.find((c) => c.from === from && c.to === to)
  }));
