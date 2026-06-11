import React, { useEffect, useMemo, useState } from 'react';
import { useStore } from 'zustand';
import {
  VscodeButton,
  VscodeCollapsible,
  VscodeDivider,
  VscodeOption,
  VscodeSingleSelect,
  VscodeTextfield
} from '@vscode-elements/react-elements';
import { useSystem } from '@/system';
import type { GraphJSON } from '@kiberon-labs/behave-graph';
import { Download, Plus, Trash } from 'iconoir-react';

type CustomEventJSON = NonNullable<GraphJSON['customEvents']>[number];

type CustomEventParameterJSON = NonNullable<
  CustomEventJSON['parameters']
>[number];

const nextNumericId = (events: Array<{ id: string }>) => {
  const used = new Set(events.map((e) => String(e.id)));
  let i = 0;
  while (used.has(String(i))) i += 1;
  return String(i);
};

export const CustomEventsEditor: React.FC = () => {
  const system = useSystem();

  const eventsStoreApi = system.eventsStore;
  const persistedEvents = useStore(system.eventsStore, (s) =>
    Object.values(s.customEvents)
  );

  const controls = useStore(system.controlStore, (s) => s.controls);
  const defaultControl = useStore(system.controlStore, (s) => s.defaultControl);

  const valueTypeOptions = useMemo(
    () => Object.keys(controls).sort((a, b) => a.localeCompare(b)),
    [controls]
  );

  const [newEventName, setNewEventName] = useState('');

  const [dirtyEventUiIds, setDirtyEventUiIds] = useState<string[]>([]);
  const [draftEvents, setDraftEvents] = useState<CustomEventJSON[]>([]);

  const isClean = dirtyEventUiIds.length === 0;

  const markDirty = (uiId: string) => {
    setDirtyEventUiIds((prev) =>
      prev.includes(uiId) ? prev : [...prev, uiId]
    );
  };

  const markClean = (uiId: string) => {
    setDirtyEventUiIds((prev) => prev.filter((id) => id !== uiId));
  };

  useEffect(() => {
    if (!isClean) return;
    setDraftEvents(persistedEvents);
  }, [isClean, persistedEvents]);

  const commitEvent = (uiId: string) => {
    const draft = draftEvents.find((e) => String(e.id) === uiId);
    if (!draft) return;

    const persisted = persistedEvents;
    const existing = persisted.find((e) => String(e.id) === uiId);
    const oldId = existing ? String(existing.id ?? '') : undefined;

    const usedIds = new Set(
      persisted.filter((e) => String(e.id) !== uiId).map((e) => String(e.id))
    );

    const desiredId = String(draft.id);
    let finalId = desiredId;
    if (usedIds.has(desiredId)) {
      finalId = oldId ?? nextNumericId(persisted);
    }

    const normalized = { ...draft, id: finalId };

    const nextPersisted = existing
      ? persisted.map((e) => (String(e.id) === uiId ? normalized : e))
      : [...persisted, normalized];

    // Convert array to Record for store
    const nextPersistedRecord: Record<string, CustomEventJSON> = {};
    nextPersisted.forEach((evt) => {
      nextPersistedRecord[String(evt.id)] = evt;
    });

    eventsStoreApi.getState().setCustomEvents(nextPersistedRecord);

    const stored = eventsStoreApi.getState().getCustomEvents();
    const storedEvent = stored.find((e) => String(e.id) === uiId);
    if (storedEvent) {
      setDraftEvents((prev) =>
        prev.map((e) => (String(e.id) === uiId ? storedEvent : e))
      );
    }

    markClean(uiId);
  };

  const updateDraftEvent = (id: string, patch: Partial<CustomEventJSON>) => {
    setDraftEvents((prev) =>
      prev.map((e) => {
        if (String(e.id) !== String(id)) return e;
        return { ...e, ...patch };
      })
    );
    markDirty(id);
  };

  const removeDraftEvent = (uiId: string) => {
    const persisted = persistedEvents;
    const persistedMatch = persisted.find((e) => String(e.id) === uiId);

    setDraftEvents((prev) => prev.filter((e) => String(e.id) !== String(uiId)));

    // If it exists in the store, delete it immediately.
    if (persistedMatch) {
      const idToRemove = String(persistedMatch.id);
      if (idToRemove) eventsStoreApi.getState().removeCustomEvent(idToRemove);
    }

    markClean(uiId);
  };

  const addDraftEvent = () => {
    const nextId = nextNumericId(draftEvents);
    const created: CustomEventJSON = {
      id: nextId,
      name: newEventName.trim() || 'NewCustomEvent',
      parameters: []
    };
    setDraftEvents((prev) => [...prev, created]);
    setNewEventName('');
    markDirty(String(created.id));
  };

  const addDraftParameter = (uiId: string) => {
    const vt = valueTypeOptions[0] ?? 'string';
    const defaultValue =
      vt === 'boolean'
        ? false
        : vt === 'number' || vt === 'float' || vt === 'integer'
          ? 0
          : '';

    setDraftEvents((prev) =>
      prev.map((e) => {
        if (String(e.id) !== String(uiId)) return e;
        const parameters = [
          ...((e.parameters ?? []) as CustomEventParameterJSON[]),
          {
            name: 'param',
            valueTypeName: vt,
            defaultValue
          }
        ];
        return { ...e, parameters };
      })
    );
    markDirty(uiId);
  };

  const updateDraftParameter = (
    uiId: string,
    index: number,
    patch: Partial<CustomEventParameterJSON>
  ) => {
    setDraftEvents((prev) =>
      prev.map((e) => {
        if (String(e.id) !== String(uiId)) return e;
        const parameters = [
          ...((e.parameters ?? []) as CustomEventParameterJSON[])
        ];
        if (!parameters[index]) return e;
        parameters[index] = { ...parameters[index], ...patch };
        return { ...e, parameters };
      })
    );
    markDirty(uiId);
  };

  const removeDraftParameter = (uiId: string, index: number) => {
    setDraftEvents((prev) =>
      prev.map((e) => {
        if (String(e.id) !== String(uiId)) return e;
        const parameters = [
          ...((e.parameters ?? []) as CustomEventParameterJSON[])
        ];
        parameters.splice(index, 1);
        return { ...e, parameters };
      })
    );
    markDirty(uiId);
  };

  return (
    <div className="h-full w-full flex flex-col p-2 gap-2">
      <div className="flex items-center gap-2 pb-2 border-b border-gray-700">
        <h2 className="text-lg font-semibold">Custom Events</h2>
      </div>

      <div className="flex items-center gap-2">
        <VscodeTextfield
          placeholder="New event name"
          value={newEventName}
          onInput={(e: Event) => {
            const target = e.target as HTMLInputElement;
            setNewEventName(target.value);
          }}
        />
        <VscodeButton onClick={addDraftEvent}>Add</VscodeButton>
      </div>

      <VscodeDivider />

      {draftEvents.length === 0 ? (
        <div className="text-gray-500 text-center py-4">
          No custom events yet.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {draftEvents.map((evt) => {
            const parameters = (evt.parameters ??
              []) as CustomEventParameterJSON[];
            const eventId = String(evt.id);
            const uiKey = String(evt.id);
            const isEventDirty = dirtyEventUiIds.includes(uiKey);

            return (
              <VscodeCollapsible key={uiKey} title={`${evt.name} (${eventId})`}>
                <div className="flex flex-col gap-2 p-2">
                  <div className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-4 flex flex-col gap-1">
                      <div className="text-xs text-gray-300">id</div>
                      <VscodeTextfield
                        value={String(evt.id)}
                        onInput={(e: Event) => {
                          const target = e.target as HTMLInputElement;
                          updateDraftEvent(uiKey, {
                            id: String(target.value)
                          });
                        }}
                      />
                    </div>

                    <div className="col-span-6 flex flex-col gap-1">
                      <div className="text-xs text-gray-300">name</div>
                      <VscodeTextfield
                        value={String(evt.name)}
                        onInput={(e: Event) => {
                          const target = e.target as HTMLInputElement;
                          updateDraftEvent(uiKey, {
                            name: String(target.value)
                          });
                        }}
                      />
                    </div>

                    <div className="col-span-2 flex justify-end gap-1">
                      <VscodeButton
                        iconOnly
                        title="Save"
                        disabled={!isEventDirty}
                        onClick={() => commitEvent(uiKey)}
                      >
                        <Download />
                      </VscodeButton>
                      <VscodeButton
                        secondary
                        iconOnly
                        title="Delete event"
                        onClick={() => removeDraftEvent(uiKey)}
                      >
                        <Trash />
                      </VscodeButton>
                    </div>
                  </div>

                  <VscodeDivider />

                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">Parameters</div>
                    <VscodeButton
                      secondary
                      iconOnly
                      title="Add parameter"
                      onClick={() => addDraftParameter(uiKey)}
                    >
                      <Plus />
                    </VscodeButton>
                  </div>

                  {parameters.length === 0 ? (
                    <div className="text-gray-500 text-sm">No parameters.</div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <div className="grid grid-cols-12 gap-2 text-xs text-gray-300">
                        <div className="col-span-4">name</div>
                        <div className="col-span-3">type</div>
                        <div className="col-span-4">default</div>
                        <div className="col-span-1" />
                      </div>

                      {parameters.map((param, index) => {
                        const Control =
                          controls[String(param.valueTypeName)] ??
                          defaultControl;

                        return (
                          <div
                            key={`${eventId}:${index}`}
                            className="grid grid-cols-12 gap-2 items-center"
                          >
                            <VscodeTextfield
                              className="col-span-4"
                              value={String(param.name)}
                              onInput={(e: Event) => {
                                const target = e.target as HTMLInputElement;
                                updateDraftParameter(uiKey, index, {
                                  name: String(target.value)
                                });
                              }}
                            />

                            <VscodeSingleSelect
                              className="col-span-3"
                              value={String(param.valueTypeName)}
                              onChange={(e: Event) => {
                                const target = e.target as HTMLSelectElement;
                                updateDraftParameter(uiKey, index, {
                                  valueTypeName: String(target.value)
                                });
                              }}
                            >
                              {valueTypeOptions.map((vt) => (
                                <VscodeOption key={vt} value={vt}>
                                  {vt}
                                </VscodeOption>
                              ))}
                            </VscodeSingleSelect>

                            <div className="col-span-4 min-w-0">
                              <Control
                                value={param.defaultValue}
                                onChange={(v) =>
                                  updateDraftParameter(uiKey, index, {
                                    defaultValue: v
                                  })
                                }
                                valueType={String(param.valueTypeName ?? '')}
                              />
                            </div>

                            <VscodeButton
                              secondary
                              iconOnly
                              title="Delete parameter"
                              onClick={() => removeDraftParameter(uiKey, index)}
                            >
                              <Trash />
                            </VscodeButton>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </VscodeCollapsible>
            );
          })}
        </div>
      )}
    </div>
  );
};
