import React, { useCallback } from 'react';
import type { ControlProps } from '@/store/controls';
import { VscodeTextfield } from '@vscode-elements/react-elements';

export const NumberControl: React.FC<ControlProps> = ({
  value,
  onChange,
  valueType
}) => {
  const isInteger = valueType === 'integer';

  const handleChange = useCallback(
    (e: Event) => {
      //WOW the @vscode-elements/react-elements typings are really bad, we have to do this hack to get the value out of the event
      const stringValue = (e as unknown as React.ChangeEvent<HTMLInputElement>)
        .currentTarget.value;
      const num = isInteger
        ? parseInt(stringValue, 10)
        : parseFloat(stringValue);
      if (!isNaN(num)) {
        onChange(num);
      }
    },
    [isInteger, onChange]
  );

  return (
    <VscodeTextfield
      type="number"
      value={value ?? ''}
      onChange={handleChange}
      step={isInteger ? 1 : undefined}
    />
  );
};
