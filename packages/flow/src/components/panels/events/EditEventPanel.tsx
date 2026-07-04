import React, { useEffect, useMemo, useState } from 'react';
import { useStore } from 'zustand';
import {
  VscodeBadge,
  VscodeButton,
  VscodeOption,
  VscodeSingleSelect,
  VscodeTextfield
} from '@vscode-elements/react-elements';

import { useActiveGraph } from '@/system';
import { BasePanel } from '../base';
import styles from './styles.module.css';
import type { ExtendedCustomEventJSON } from '@/store/events';
import { Plus, Trash, ArrowLeft, FloppyDisk, TrashSolid } from 'iconoir-react';
import { Icon } from '@/components/primitives/icon';

type CustomEventParameterJSON = NonNullable<
  ExtendedCustomEventJSON['parameters']
>[number];

interface EditEventPanelProps {
  eventUiId: string | null;
  onBack: () => void;
}

export const EditEventPanel: React.FC<EditEventPanelProps> = ({
  eventUiId,
  onBack
}) => {
  const system = useActiveGraph()!;

  const rawEvents = useStore(system.eventsStore, (s) => s.customEvents);

  const controls = useStore(system.controlStore, (s) => s.controls);
  const defaultControl = useStore(system.controlStore, (s) => s.defaultControl);
  const registry = useStore(system.editor.registry);

  const valueTypeOptions = useMemo(
    () => Object.keys(controls).sort((a, b) => a.localeCompare(b)),
    [controls]
  );

  const [draftEvent, setDraftEvent] = useState<ExtendedCustomEventJSON | null>(
    null
  );
  const [isDirty, setIsDirty] = useState(true);
  const isReadonly = draftEvent?.readonly === true;
  // Load event when eventUiId changes
  useEffect(() => {
    if (!eventUiId) {
      setDraftEvent(null);
      setIsDirty(true);
      return;
    }

    const event = rawEvents[eventUiId];
    if (event) {
      setDraftEvent({ ...event });
      setIsDirty(true);
    }
  }, [eventUiId, rawEvents]);

  const updateDraft = (patch: Partial<ExtendedCustomEventJSON>) => {
    if (!draftEvent || isReadonly) return;
    setDraftEvent({ ...draftEvent, ...patch });
    setIsDirty(true);
  };

  const addParameter = () => {
    if (!draftEvent || isReadonly) return;

    const vt = valueTypeOptions[0] ?? 'string';
    const valueType = registry.values[vt];
    const defaultValue = valueType ? valueType.creator() : '';

    const parameters = [
      ...(draftEvent.parameters ?? []),
      {
        name: 'param',
        valueTypeName: vt,
        defaultValue
      }
    ];

    updateDraft({ parameters });
  };

  const updateParameter = (
    index: number,
    patch: Partial<CustomEventParameterJSON>
  ) => {
    if (!draftEvent || isReadonly) return;

    const parameters = [...(draftEvent.parameters ?? [])];
    if (!parameters[index]) return;

    // If valueTypeName is being changed, reset defaultValue to the new type's default
    if (
      patch.valueTypeName !== undefined &&
      patch.valueTypeName !== parameters[index]?.valueTypeName
    ) {
      const valueType = registry.values[patch.valueTypeName];
      if (valueType) {
        patch.defaultValue = valueType.creator();
      }
    }

    parameters[index] = {
      ...parameters[index],
      ...patch
    } as CustomEventParameterJSON;
    updateDraft({ parameters });
  };

  const removeParameter = (index: number) => {
    if (!draftEvent || isReadonly) return;

    const parameters = [...(draftEvent.parameters ?? [])];
    parameters.splice(index, 1);
    updateDraft({ parameters });
  };

  const saveEvent = () => {
    if (!draftEvent || !eventUiId || isReadonly) return;
    system.eventsStore.getState().addCustomEvent(draftEvent);
    setIsDirty(false);
    onBack();
  };

  const deleteEvent = () => {
    if (!draftEvent || isReadonly) return;

    system.eventsStore.getState().removeCustomEvent(String(draftEvent.id));
    onBack();
  };

  if (!draftEvent) {
    return (
      <BasePanel>
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
        >
          <div style={{ color: 'var(--ds-fg-muted)', textAlign: 'center' }}>
            Select an event to edit
          </div>
        </div>
      </BasePanel>
    );
  }

  const parameters = draftEvent.parameters ?? [];

  return (
    <BasePanel>
      <div className={styles.editRoot}>
        <div className={styles.editorHeader}>
          <VscodeButton
            iconOnly
            secondary
            onClick={onBack}
            title="Back to list"
          >
            <ArrowLeft width={16} height={16} />
          </VscodeButton>
          <h2 className={styles.headerTitle}>
            Edit Event
            {isReadonly && <VscodeBadge>Read-only</VscodeBadge>}
          </h2>
        </div>

        <div className={styles.editorFields}>
          <div className={styles.formGrid}>
            <div className={`${styles.formField}`}>
              <div className={styles.formLabel}>id</div>
              <VscodeTextfield
                value={String(draftEvent.id)}
                onInput={(e: Event) => {
                  const target = e.target as HTMLInputElement;
                  updateDraft({ id: String(target.value) });
                }}
                disabled={isReadonly}
              />
            </div>

            <div className={`${styles.formField}`}>
              <div className={styles.formLabel}>name</div>
              <VscodeTextfield
                value={String(draftEvent.name)}
                onInput={(e: Event) => {
                  const target = e.target as HTMLInputElement;
                  updateDraft({ name: String(target.value) });
                }}
                disabled={isReadonly}
              />
            </div>
          </div>
        </div>

        <div className={styles.parametersSection}>
          <div className={styles.parametersHeader}>
            <div className={styles.parametersTitle}>Parameters</div>
            {!isReadonly && (
              <Icon title="Add parameter" onClick={addParameter}>
                <Plus />
              </Icon>
            )}
          </div>
          <div className={styles.parametersContent}>
            {parameters.length === 0 ? (
              <div className={styles.parametersEmpty}>No parameters.</div>
            ) : (
              <div className={styles.parametersGrid}>
                {parameters.map((param, index) => {
                  const Control =
                    controls[String(param.valueTypeName)] ?? defaultControl;

                  return (
                    <div key={index} className={styles.parameterRow}>
                      <div className={styles.parameterField}>
                        <div>
                          <div className={styles.parameterFieldLabel}>name</div>
                          {!isReadonly && (
                            <Icon
                              className={styles.parameterDelete}
                              title="Delete parameter"
                              onClick={() => removeParameter(index)}
                            >
                              <TrashSolid />
                            </Icon>
                          )}
                        </div>
                        <VscodeTextfield
                          style={{ width: '100%' }}
                          value={String(param.name)}
                          onInput={(e: Event) => {
                            const target = e.target as HTMLInputElement;
                            updateParameter(index, {
                              name: String(target.value)
                            });
                          }}
                          disabled={isReadonly}
                        />
                      </div>

                      <div className={styles.parameterField}>
                        <div className={styles.parameterFieldLabel}>type</div>
                        <VscodeSingleSelect
                          value={String(param.valueTypeName)}
                          onChange={(e: Event) => {
                            const target = e.target as HTMLSelectElement;
                            updateParameter(index, {
                              valueTypeName: String(target.value)
                            });
                          }}
                          disabled={isReadonly}
                        >
                          {valueTypeOptions.map((vt) => (
                            <VscodeOption key={vt} value={vt}>
                              {vt}
                            </VscodeOption>
                          ))}
                        </VscodeSingleSelect>
                      </div>

                      <div className={styles.parameterField}>
                        <div className={styles.parameterFieldLabel}>
                          default
                        </div>
                        <div
                          className={styles.controlWrapper}
                          style={{
                            opacity: isReadonly ? 0.5 : 1,
                            pointerEvents: isReadonly ? 'none' : 'auto'
                          }}
                        >
                          <Control
                            value={param.defaultValue}
                            onChange={(v) =>
                              updateParameter(index, { defaultValue: v })
                            }
                            valueType={String(param.valueTypeName)}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className={styles.editorActions}>
          <div className={styles.actions}>
            <VscodeButton
              iconOnly
              onClick={saveEvent}
              disabled={!isDirty || isReadonly}
            >
              <FloppyDisk width={16} height={16} />
              Save
            </VscodeButton>
            <VscodeButton
              iconOnly
              secondary
              onClick={deleteEvent}
              disabled={isReadonly}
            >
              <Trash width={16} height={16} />
            </VscodeButton>
          </div>
        </div>
      </div>
    </BasePanel>
  );
};
