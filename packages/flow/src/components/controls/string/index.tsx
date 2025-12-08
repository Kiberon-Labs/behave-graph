import React from 'react';
import type { ControlProps } from '@/store/controls';
import { VscodeTextfield } from '@vscode-elements/react-elements';

export const StringControl: React.FC<ControlProps> = ({ value, onChange }) => {
  return (
    <VscodeTextfield
      type="text"
      value={value ?? ''}
      onChange={(e) => onChange(e.currentTarget.value)}
    />
  );
};
