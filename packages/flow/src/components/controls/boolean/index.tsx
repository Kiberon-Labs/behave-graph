import React from 'react';
import type { ControlProps } from '@/store/controls';
import { VscodeCheckbox } from '@vscode-elements/react-elements';

export const BooleanControl: React.FC<ControlProps> = ({ value, onChange }) => {
  return (
    <VscodeCheckbox
      type="checkbox"
      checked={!!value}
      onChange={(e) => onChange(e.currentTarget.checked)}
    />
  );
};
