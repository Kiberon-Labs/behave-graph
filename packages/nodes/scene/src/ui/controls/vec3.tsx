import React from 'react';

import { VscodeTextfield } from '@vscode-elements/react-elements';
import type { ControlProps } from '@kiberon-labs/behave-graph-flow';
import type { Vec3JSON } from '@/Values/Internal/Vec3';

export const Vec3Control: React.FC<ControlProps<Vec3JSON>> = ({
  value,
  onChange
}) => {
  const vec = value ?? [0, 0, 0];

  const handleChangeX = (e: React.ChangeEvent<HTMLInputElement>) => {
    const stringValue = e.currentTarget.value;
    const num = parseFloat(stringValue);
    if (!isNaN(num)) {
      onChange([num, vec[1], vec[2]]);
    }
  };

  const handleChangeY = (e: React.ChangeEvent<HTMLInputElement>) => {
    const stringValue = e.currentTarget.value;
    const num = parseFloat(stringValue);
    if (!isNaN(num)) {
      onChange([vec[0], num, vec[2]]);
    }
  };

  const handleChangeZ = (e: React.ChangeEvent<HTMLInputElement>) => {
    const stringValue = e.currentTarget.value;
    const num = parseFloat(stringValue);
    if (!isNaN(num)) {
      onChange([vec[0], vec[1], num]);
    }
  };

  return (
    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
      <label style={{ fontSize: '11px', opacity: 0.7, minWidth: '12px' }}>
        X
      </label>
      <VscodeTextfield
        type="number"
        step="any"
        value={vec[0].toString()}
        onChange={handleChangeX}
        style={{ flex: 1 }}
      />
      <label style={{ fontSize: '11px', opacity: 0.7, minWidth: '12px' }}>
        Y
      </label>
      <VscodeTextfield
        type="number"
        step="any"
        value={vec[1].toString()}
        onChange={handleChangeY}
        style={{ flex: 1 }}
      />
      <label style={{ fontSize: '11px', opacity: 0.7, minWidth: '12px' }}>
        Z
      </label>
      <VscodeTextfield
        type="number"
        value={vec[2].toString()}
        step="any"
        onChange={handleChangeZ}
        style={{ flex: 1 }}
      />
    </div>
  );
};
