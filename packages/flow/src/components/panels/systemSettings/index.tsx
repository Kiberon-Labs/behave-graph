import { Fragment, useMemo, useState } from 'react';
import { useStore } from 'zustand';
import {
  VscodeCheckbox,
  VscodeDivider,
  VscodeOption,
  VscodeSingleSelect,
  VscodeTextfield
} from '@vscode-elements/react-elements';
import { Undo } from 'iconoir-react';
import { useSystem } from '@/system/provider';
import type { SettingDescriptor, SettingsValues } from '@/store/settingsSchema';
import styles from './styles.module.css';
import { BasePanel } from '../base';
import { SectionTitle } from '../common/SectionTitle';
import { ConversionsSettings } from './ConversionsSettings';

type RowProps = {
  descriptor: SettingDescriptor;
  value: unknown;
  setValue: (value: unknown) => void;
};

/** The input control for a descriptor, chosen by its `type`. */
const SettingControl = ({ descriptor, value, setValue }: RowProps) => {
  switch (descriptor.type) {
    case 'boolean':
      return (
        <VscodeCheckbox
          checked={Boolean(value)}
          onChange={(e: any) => setValue(Boolean(e?.target?.checked))}
        />
      );
    case 'enum':
      return (
        <VscodeSingleSelect
          value={String(value ?? '')}
          onChange={(e: any) => {
            const next = e?.target?.value as string | undefined;
            if (next !== undefined) setValue(next);
          }}
        >
          {descriptor.options.map((option) => (
            <VscodeOption key={option.value} value={option.value}>
              {option.label}
            </VscodeOption>
          ))}
        </VscodeSingleSelect>
      );
    case 'number':
      return (
        <VscodeTextfield
          type="number"
          value={String(value ?? '')}
          min={descriptor.min}
          max={descriptor.max}
          step={descriptor.step}
          style={{ width: '100%' }}
          onChange={(e: any) => {
            const next = Number(e?.target?.value);
            if (!Number.isNaN(next)) setValue(next);
          }}
        />
      );
    case 'string':
      return (
        <VscodeTextfield
          value={String(value ?? '')}
          placeholder={descriptor.placeholder}
          style={{ width: '100%' }}
          onChange={(e: any) => setValue(String(e?.target?.value ?? ''))}
        />
      );
    case 'custom': {
      const Render = descriptor.render;
      return (
        <Render value={value} setValue={setValue} descriptor={descriptor} />
      );
    }
  }
};

const ResetButton = ({ onClick }: { onClick: () => void }) => (
  <button
    type="button"
    className={styles.reset}
    title="Reset to default"
    aria-label="Reset to default"
    onClick={onClick}
  >
    <Undo width={13} height={13} />
  </button>
);

const Label = ({
  descriptor,
  modified
}: {
  descriptor: SettingDescriptor;
  modified: boolean;
}) => (
  <span className={styles.label}>
    {descriptor.title}
    {modified && <span className={styles.modified} title="Modified" />}
  </span>
);

/** A single auto-generated setting row. Booleans put the control inline with the
 *  label (toggle layout); other types stack the control under the label. */
const SettingRow = ({ descriptor, value, setValue }: RowProps) => {
  const modified = descriptor.type !== 'custom' && value !== descriptor.default;
  const reset = () => setValue(descriptor.default);

  if (descriptor.type === 'custom') {
    return (
      <div className={styles.setting}>
        {descriptor.title && (
          <span className={styles.label}>{descriptor.title}</span>
        )}
        {descriptor.description && (
          <span className={styles.description}>{descriptor.description}</span>
        )}
        <SettingControl
          descriptor={descriptor}
          value={value}
          setValue={setValue}
        />
      </div>
    );
  }

  if (descriptor.type === 'boolean') {
    return (
      <div className={`${styles.setting} ${styles.toggle}`}>
        <SettingControl
          descriptor={descriptor}
          value={value}
          setValue={setValue}
        />
        <div className={styles.body}>
          <Label descriptor={descriptor} modified={modified} />
          {descriptor.description && (
            <span className={styles.description}>{descriptor.description}</span>
          )}
        </div>
        {modified && <ResetButton onClick={reset} />}
      </div>
    );
  }

  return (
    <div className={styles.setting}>
      <div className={styles.labelRow}>
        <Label descriptor={descriptor} modified={modified} />
        {modified && <ResetButton onClick={reset} />}
      </div>
      {descriptor.description && (
        <span className={styles.description}>{descriptor.description}</span>
      )}
      <SettingControl
        descriptor={descriptor}
        value={value}
        setValue={setValue}
      />
    </div>
  );
};

/**
 * Schema-driven Settings panel. Rows are auto-generated from the descriptor
 * registry (`system.settingsSchema`) — built-in and plugin-contributed settings
 * render through the same path — grouped by section, filterable, with reset.
 */
export const Settings = () => {
  const system = useSystem();
  const descriptors = useStore(system.settingsSchema, (s) => s.settings);
  const sectionOrder = useStore(system.settingsSchema, (s) => s.sectionOrder);
  const values = useStore(system.systemSettings) as SettingsValues & {
    setSetting: (key: string, value: unknown) => void;
  };
  const [query, setQuery] = useState('');

  const bySection = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = (d: SettingDescriptor) =>
      !q ||
      [d.title, d.description, d.section, d.key].some(
        (field) => typeof field === 'string' && field.toLowerCase().includes(q)
      );
    const visible = (d: SettingDescriptor) => (d.when ? d.when(values) : true);

    const map = new Map<string, SettingDescriptor[]>();
    for (const descriptor of descriptors) {
      if (!matches(descriptor) || !visible(descriptor)) continue;
      const rows = map.get(descriptor.section) ?? [];
      rows.push(descriptor);
      map.set(descriptor.section, rows);
    }
    for (const rows of map.values()) {
      rows.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    }
    return map;
  }, [descriptors, query, values]);

  const visibleSections = sectionOrder.filter(
    (section) => (bySection.get(section)?.length ?? 0) > 0
  );

  return (
    <BasePanel>
      <div className={styles.searchRow}>
        <VscodeTextfield
          value={query}
          placeholder="Search settings"
          style={{ width: '100%' }}
          onChange={(e: any) => setQuery(String(e?.target?.value ?? ''))}
        />
      </div>

      {visibleSections.length === 0 ? (
        <div className={styles.empty}>No settings match “{query}”.</div>
      ) : (
        <div className={styles.list}>
          {visibleSections.map((section, index) => (
            <Fragment key={section}>
              {index > 0 && <VscodeDivider className={styles.divider} />}
              <SectionTitle>{section}</SectionTitle>
              {bySection.get(section)!.map((descriptor) => (
                <Fragment key={descriptor.key}>
                  <SettingRow
                    descriptor={descriptor}
                    // Fall back to the descriptor default so plugin-registered
                    // settings (whose value is not seeded into the settings
                    // store until first changed) show their real initial state.
                    value={values[descriptor.key] ?? descriptor.default}
                    setValue={(next) => values.setSetting(descriptor.key, next)}
                  />
                  {/* The conversions editor is a bespoke built-in control shown
                      under Auto-convert when it is enabled. */}
                  {descriptor.key === 'autoConvert' && values.autoConvert ? (
                    <ConversionsSettings />
                  ) : null}
                </Fragment>
              ))}
            </Fragment>
          ))}
        </div>
      )}
    </BasePanel>
  );
};
