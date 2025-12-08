import React from 'react';
import type { ControlProps } from '@/store/controls';
import { VscodeTextfield } from '@vscode-elements/react-elements';

export const NumberControl: React.FC<ControlProps> = ({
  value,
  onChange,
  valueType
}) => {
  const isInteger = valueType === 'integer';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const stringValue = e.currentTarget.value;
    const num = isInteger ? parseInt(stringValue, 10) : parseFloat(stringValue);
    if (!isNaN(num)) {
      onChange(num);
    }
  };

  return (
    <VscodeTextfield
      type="number"
      value={value ?? ''}
      onChange={handleChange}
      step={isInteger ? 1 : undefined}
    />
  );
};
