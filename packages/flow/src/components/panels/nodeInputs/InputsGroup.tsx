import React from 'react';
import { InputControl } from './InputControl';
import type { ControlComponent } from '@/store/controls';
import styles from './index.module.css';
import { EyeClosed, EyeSolid } from 'iconoir-react';
import { Icon } from '@/components/primitives/icon';
import type { ChoiceJSON } from '@kiberon-labs/behave-graph';

export interface InputItem {
  name: string;
  valueType: string;
  defaultValue?: unknown;
  choices?: ChoiceJSON;
  value: unknown;
  connected: boolean;
}

interface InputsGroupProps {
  inputs: InputItem[];
  controls: Record<string, ControlComponent>;
  defaultControl: ControlComponent;
  onValueChange: (inputName: string, newValue: unknown) => void;
  hiddenInputs?: Record<string, boolean>;
  onToggleInput?: (inputName: string) => void;
}

export const InputsGroup: React.FC<InputsGroupProps> = ({
  inputs,
  controls,
  defaultControl,
  onValueChange,
  hiddenInputs = {},
  onToggleInput
}) => {
  if (inputs.length === 0) return null;
  return (
    <div className={styles.stackColPadded}>
      {inputs.map((input) => {
        const Control = controls[input.valueType] ?? defaultControl;
        const isHidden = hiddenInputs[input.name] ?? false;

        return (
          <div key={input.name} className={styles.inputWithToggle}>
            {onToggleInput && (
              <Icon
                className={styles.inputToggle}
                onClick={() => onToggleInput(input.name)}
                title={isHidden ? 'Show input on node' : 'Hide input on node'}
              >
                {isHidden ? <EyeClosed /> : <EyeSolid />}
              </Icon>
            )}
            <div className={styles.inputControlWrapper}>
              <InputControl
                input={input}
                ControlComponent={Control}
                onValueChange={onValueChange}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
