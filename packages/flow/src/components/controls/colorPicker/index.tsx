import { VscodeButton, VscodeTextfield } from '@vscode-elements/react-elements';
import { HexColorPicker } from 'react-colorful';
import { PopoverClose } from '@radix-ui/react-popover';
import InputPopover from './InputPopover.js';
import React from 'react';
import styles from './index.module.css';

export function ColorPicker({
  value,
  onChange
}: Pick<ColorPickerPopoverProps, 'value' | 'onChange'>) {
  return (
    <HexColorPicker
      color={value}
      onChange={onChange}
      style={{ flexShrink: 0 }}
    />
  );
}

type ColorPickerPopoverProps = {
  value: string;
  defaultOpen?: boolean;
  onChange: (value: string) => void;
  showRemoveButton?: boolean;
  onRemove?: () => void;
};

export function ColorPickerPopover({
  value,
  defaultOpen = false,
  onChange,
  showRemoveButton = false,
  onRemove
}: ColorPickerPopoverProps) {
  return (
    <InputPopover
      defaultOpen={defaultOpen}
      trigger={
        <button
          style={{ background: value }}
          className={styles.colorPickerTrigger}
        />
      }
    >
      <ColorPicker value={value} onChange={onChange} />
      <VscodeTextfield
        value={value}
        onChange={(event) => {
          onChange(event.target?.value);
        }}
      />
      {showRemoveButton && (
        <PopoverClose className={styles.popoverCloseRemoveButton}>
          <VscodeButton onClick={onRemove} style={{ background: 'red' }}>
            Remove color
          </VscodeButton>
        </PopoverClose>
      )}
    </InputPopover>
  );
}
