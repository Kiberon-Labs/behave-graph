import React from 'react';
import type { ControlProps } from '@/store/controls';
import {
  VscodeTextarea,
  VscodeTextfield
} from '@vscode-elements/react-elements';

export const StringControl: React.FC<ControlProps> = ({ value, onChange }) => {
  return (
    <VscodeTextarea
      // type="text"
      value={value ?? ''}
      onChange={(e) => onChange((e.currentTarget as HTMLTextAreaElement).value)}
    />
  );
};
