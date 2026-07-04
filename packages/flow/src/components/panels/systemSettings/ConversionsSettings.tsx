import React, { useEffect, useMemo, useState } from 'react';
import { useStore } from 'zustand';
import {
  VscodeButton,
  VscodeOption,
  VscodeSingleSelect
} from '@vscode-elements/react-elements';
import { Trash } from 'iconoir-react';
import { useSystem } from '@/system/provider';
import styles from './styles.module.css';

/**
 * Editor for the custom automatic type conversions used by auto-convert. Rules
 * defined here override the generic spec-derived defaults and are persisted with
 * the editor settings.
 *
 * A rule pins the converter node AND the specific ports to wire: which input
 * receives the `from` value and which output produces the `to` value. The port
 * choices are filtered to type-compatible sockets, so converter nodes with more
 * than one input/output resolve unambiguously.
 */
export const ConversionsSettings: React.FC = () => {
  const sys = useSystem();
  const values = useStore(sys.registry, (s) => s.values);
  const specs = useStore(sys.specStore, (s) => s.specs);
  const conversions = useStore(sys.conversionStore, (s) => s.conversions);

  const valueTypes = useMemo(
    () => Object.keys(values).filter((t) => t !== 'flow'),
    [values]
  );
  const nodeTypes = useMemo(() => specs.map((s) => s.type).sort(), [specs]);

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [nodeType, setNodeType] = useState('');
  const [inputKey, setInputKey] = useState('');
  const [outputKey, setOutputKey] = useState('');

  const selectedSpec = useMemo(
    () => specs.find((s) => s.type === nodeType),
    [specs, nodeType]
  );

  // Only ports whose type matches the conversion endpoints are valid targets:
  // the spliced node must accept `from` and emit `to`.
  const inputPorts = useMemo(
    () =>
      (selectedSpec?.inputs ?? []).filter(
        (i) => i.valueType !== 'flow' && (!from || i.valueType === from)
      ),
    [selectedSpec, from]
  );
  const outputPorts = useMemo(
    () =>
      (selectedSpec?.outputs ?? []).filter(
        (o) => o.valueType !== 'flow' && (!to || o.valueType === to)
      ),
    [selectedSpec, to]
  );

  // Default the port selection to the first compatible socket whenever the node
  // or endpoints change; the user can still override when several ports match.
  useEffect(() => {
    setInputKey(inputPorts[0]?.name ?? '');
  }, [inputPorts]);
  useEffect(() => {
    setOutputKey(outputPorts[0]?.name ?? '');
  }, [outputPorts]);

  const nodeChosen = Boolean(nodeType);
  const portsMissing =
    nodeChosen && (inputPorts.length === 0 || outputPorts.length === 0);
  const canAdd =
    Boolean(from && to && nodeType && inputKey && outputKey) && from !== to;

  const add = () => {
    if (!canAdd) return;
    sys.conversionStore
      .getState()
      .registerConversion({ from, to, nodeType, inputKey, outputKey });
    setFrom('');
    setTo('');
    setNodeType('');
    setInputKey('');
    setOutputKey('');
  };

  return (
    <div className={styles.conversions}>
      <span className={styles.conversionsLabel}>
        Custom rules override the built-in defaults.
      </span>
      {conversions.length === 0 && (
        <div className={styles.empty}>No custom conversions.</div>
      )}
      {conversions.map((rule) => (
        <div key={`${rule.from}->${rule.to}`} className={styles.rule}>
          <span className={styles.ruleText}>
            {rule.from} → {rule.to}{' '}
            <span className={styles.ruleNode}>
              ({rule.nodeType}
              {rule.inputKey && rule.outputKey
                ? `: ${rule.inputKey} → ${rule.outputKey}`
                : ''}
              )
            </span>
          </span>
          <VscodeButton
            secondary
            iconOnly
            title="Remove"
            onClick={() =>
              sys.conversionStore
                .getState()
                .removeConversion(rule.from, rule.to)
            }
          >
            <Trash />
          </VscodeButton>
        </div>
      ))}

      <div className={styles.addForm}>
        <VscodeSingleSelect
          value={from}
          onChange={(e: any) => setFrom(String(e?.target?.value ?? ''))}
        >
          <VscodeOption value="">from…</VscodeOption>
          {valueTypes.map((t) => (
            <VscodeOption key={t} value={t}>
              {t}
            </VscodeOption>
          ))}
        </VscodeSingleSelect>
        <VscodeSingleSelect
          value={to}
          onChange={(e: any) => setTo(String(e?.target?.value ?? ''))}
        >
          <VscodeOption value="">to…</VscodeOption>
          {valueTypes.map((t) => (
            <VscodeOption key={t} value={t}>
              {t}
            </VscodeOption>
          ))}
        </VscodeSingleSelect>
        <VscodeSingleSelect
          value={nodeType}
          onChange={(e: any) => setNodeType(String(e?.target?.value ?? ''))}
        >
          <VscodeOption value="">converter node…</VscodeOption>
          {nodeTypes.map((t) => (
            <VscodeOption key={t} value={t}>
              {t}
            </VscodeOption>
          ))}
        </VscodeSingleSelect>

        {nodeChosen && !portsMissing && (
          <>
            <VscodeSingleSelect
              value={inputKey}
              onChange={(e: any) => setInputKey(String(e?.target?.value ?? ''))}
            >
              <VscodeOption value="">input port…</VscodeOption>
              {inputPorts.map((p) => (
                <VscodeOption key={p.name} value={p.name}>
                  {p.name} ({p.valueType})
                </VscodeOption>
              ))}
            </VscodeSingleSelect>
            <VscodeSingleSelect
              value={outputKey}
              onChange={(e: any) =>
                setOutputKey(String(e?.target?.value ?? ''))
              }
            >
              <VscodeOption value="">output port…</VscodeOption>
              {outputPorts.map((p) => (
                <VscodeOption key={p.name} value={p.name}>
                  {p.name} ({p.valueType})
                </VscodeOption>
              ))}
            </VscodeSingleSelect>
          </>
        )}

        {portsMissing && (
          <span className={styles.empty}>
            “{nodeType}” has no {inputPorts.length === 0 ? `${from} input` : ''}
            {inputPorts.length === 0 && outputPorts.length === 0 ? ' / ' : ''}
            {outputPorts.length === 0 ? `${to} output` : ''} , not a valid
            converter for {from} → {to}.
          </span>
        )}

        <VscodeButton secondary disabled={!canAdd} onClick={add}>
          + Add conversion
        </VscodeButton>
      </div>
    </div>
  );
};
