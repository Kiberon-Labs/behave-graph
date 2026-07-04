import cx from 'classnames';
import React from 'react';
import { useStore } from 'zustand';

import { useSystem } from '@/system/provider';
import {
  VscodeTable,
  VscodeTableBody,
  VscodeTableCell,
  VscodeTableHeader,
  VscodeTableHeaderCell,
  VscodeTableRow
} from '@vscode-elements/react-elements';
import { BasePanel } from '../base';
import klasses from './index.module.css';

export function LegendPanel() {
  const system = useSystem();
  const { valueTypeColors, icons, defaultIcon } = useStore(system.legendStore);

  const entries = React.useMemo(() => {
    const keys = new Set<string>([
      ...Object.keys(valueTypeColors),
      ...Object.keys(icons)
    ]);

    return [...keys]
      .sort((a, b) => a.localeCompare(b))
      .map((valueType) => {
        const Icon = icons[valueType] ?? defaultIcon;
        const color = valueTypeColors[valueType];
        const [bgClass, borderClass] = [color, color];

        return {
          valueType,
          Icon,
          bgClass,
          borderClass
        };
      });
  }, [defaultIcon, icons, valueTypeColors]);

  return (
    <BasePanel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <VscodeTable zebra columns={['50', '50', 'auto']}>
          <VscodeTableHeader>
            <VscodeTableHeaderCell>Color</VscodeTableHeaderCell>
            <VscodeTableHeaderCell>Icon</VscodeTableHeaderCell>
            <VscodeTableHeaderCell>Type</VscodeTableHeaderCell>
          </VscodeTableHeader>
          <VscodeTableBody>
            {entries.map(({ valueType, Icon, bgClass, borderClass }) => (
              <VscodeTableRow key={valueType}>
                <VscodeTableCell>
                  <div
                    style={{
                      border: borderClass,
                      background: bgClass
                    }}
                    className={cx(klasses.legendCol, bgClass, borderClass)}
                    title={valueType}
                  />
                </VscodeTableCell>
                <VscodeTableCell>
                  <Icon />
                </VscodeTableCell>
                <VscodeTableCell>{valueType}</VscodeTableCell>
              </VscodeTableRow>
            ))}
          </VscodeTableBody>
        </VscodeTable>
      </div>
    </BasePanel>
  );
}
