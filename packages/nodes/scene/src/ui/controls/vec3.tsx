import React from 'react';

import { VscodeTextfield } from '@vscode-elements/react-elements';
import type { ControlProps } from '@kiberon-labs/behave-graph-flow';
import type { Vec3JSON } from '@/Values/Internal/Vec3';

// The @vscode-elements/react-elements typings surface the underlying custom
// element's DOM events, so its `onChange` hands back a plain `Event`. Pull the
// value out via the input target (same hack the flow number control uses).
const readNumber = (e: Event): number | undefined => {
  const stringValue = (e as unknown as React.ChangeEvent<HTMLInputElement>)
    .currentTarget.value;
  const num = parseFloat(stringValue);
  return isNaN(num) ? undefined : num;
};

export const Vec3Control: React.FC<ControlProps<Vec3JSON>> = ({
  value,
  onChange
}) => {
  const vec = value ?? [0, 0, 0];

  const handleChangeX = (e: Event) => {
    const num = readNumber(e);
    if (num !== undefined) onChange([num, vec[1], vec[2]]);
  };

  const handleChangeY = (e: Event) => {
    const num = readNumber(e);
    if (num !== undefined) onChange([vec[0], num, vec[2]]);
  };

  const handleChangeZ = (e: Event) => {
    const num = readNumber(e);
    if (num !== undefined) onChange([vec[0], vec[1], num]);
  };

  return (
    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
      <label style={{ fontSize: '11px', opacity: 0.7, minWidth: '12px' }}>
        X
      </label>
      <VscodeTextfield
        type="number"
        value={vec[0].toString()}
        onChange={handleChangeX}
        style={{ flex: 1 }}
      />
      <label style={{ fontSize: '11px', opacity: 0.7, minWidth: '12px' }}>
        Y
      </label>
      <VscodeTextfield
        type="number"
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
        onChange={handleChangeZ}
        style={{ flex: 1 }}
      />
    </div>
  );
};
