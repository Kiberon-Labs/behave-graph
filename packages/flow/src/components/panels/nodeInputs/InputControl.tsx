import React from 'react';
import {
  VscodeOption,
  VscodeSingleSelect
} from '@vscode-elements/react-elements';
import type { ControlComponent } from '@/store/controls';
import styles from './index.module.css';
import type { ChoiceJSON } from '@kiberon-labs/behave-graph';

interface InputControlProps {
  input: {
    name: string;
    valueType: string;
    defaultValue?: any;
    choices?: ChoiceJSON;
    value: any;
    connected: boolean;
  };
  ControlComponent: ControlComponent;
  onValueChange: (inputName: string, newValue: any) => void;
}

export const InputControl: React.FC<InputControlProps> = ({
  input,
  ControlComponent,
  onValueChange
}) => {
  return (
    <div className={styles.inputRow}>
      <div className={styles.inputMeta}>
        <div className={styles.inputName} title={input.valueType}>
          {input.name}
        </div>
        <div className={styles.inputSubtext}>
          {input.connected ? 'Connected' : input.valueType}
        </div>
      </div>

      <div>
        {input.connected ? (
          <div className={styles.connectedMessage}>Socket is connected</div>
        ) : input.choices && input.choices.length > 0 ? (
          <VscodeSingleSelect
            value={input.value ?? ''}
            onChange={(e: any) => onValueChange(input.name, e?.target?.value)}
          >
            {input.choices.map((choice) => (
              <VscodeOption key={choice.text} value={choice.value}>
                {choice.text}
              </VscodeOption>
            ))}
          </VscodeSingleSelect>
        ) : (
          <ControlComponent
            value={input.value}
            onChange={(newValue) => onValueChange(input.name, newValue)}
            valueType={input.valueType}
          />
        )}
      </div>
    </div>
  );
};
