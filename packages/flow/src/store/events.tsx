import { create } from 'zustand';
import type {
  CustomEventJSON,
  CustomEventParameterJSON
} from '@kiberon-labs/behave-graph';
export type ExtendedCustomEventJSON = CustomEventJSON & {
  readonly?: boolean;
};

export type EventsStore = {
  customEvents: Record<string, ExtendedCustomEventJSON>;
  setCustomEvents: (
    customEvents: Record<string, ExtendedCustomEventJSON>
  ) => void;
  getCustomEvents: () => ExtendedCustomEventJSON[];
  addCustomEvent: (customEvent: ExtendedCustomEventJSON) => void;
  removeCustomEvent: (id: string) => void;

  addParameter: (
    eventId: string,
    parameter?: Partial<CustomEventParameterJSON>
  ) => void;
  updateParameter: (
    eventId: string,
    index: number,
    patch: Partial<CustomEventParameterJSON>
  ) => void;
  removeParameter: (eventId: string, index: number) => void;
};

export const eventsStoreFactory = () =>
  create<EventsStore>((set, get) => ({
    customEvents: {},
    setCustomEvents: (customEvents) => {
      set({ customEvents });
    },
    getCustomEvents: () => Object.values(get().customEvents ?? {}),

    addCustomEvent: (customEvent) => {
      set((t) => ({
        customEvents: { ...t.customEvents, [customEvent.id]: customEvent }
      }));
    },

    removeCustomEvent: (id) => {
      const current = get().customEvents ?? {};
      const next = { ...current };
      delete next[String(id)];

      set({ customEvents: next });
    },
    addParameter: (eventId, parameter) => {
      const current = get().customEvents;

      const newEvent = current[eventId];
      if (!newEvent) return;

      const withUpdated = {
        ...newEvent,
        parameters: [
          ...((newEvent.parameters ?? []) as CustomEventParameterJSON[]),
          {
            name: parameter?.name ? String(parameter.name) : 'param',
            valueTypeName: parameter?.valueTypeName
              ? String(parameter.valueTypeName)
              : 'string',
            defaultValue: parameter?.defaultValue
          }
        ]
      } as CustomEventJSON;
      set({
        customEvents: {
          ...current,
          [eventId]: withUpdated
        }
      });
    },

    updateParameter: (eventId, index, patch) => {
      const current = get().customEvents;

      const ev = current[eventId];
      if (!ev) return;

      set({
        customEvents: {
          ...current,
          [eventId]: {
            ...ev,
            parameters: ev.parameters?.map((param, i) => {
              if (i !== index) return param;

              return { ...param, ...patch };
            })
          }
        }
      });
    },

    removeParameter: (eventId, index) => {
      const current = get().customEvents;

      const ev = current[eventId];
      if (!ev) return;

      set({
        customEvents: {
          ...current,
          [eventId]: {
            ...ev,
            parameters: ev.parameters?.filter((_, i) => i !== index) ?? []
          }
        }
      });
    }
  }));
