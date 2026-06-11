import React from 'react';
import styles from './index.module.css';
import { EyeClosed, EyeSolid } from 'iconoir-react';
import { Icon } from '@/components/primitives/icon';

export interface OutputItem {
  name: string;
  valueType: string;
  connected: boolean;
}

interface OutputsGroupProps {
  outputs: OutputItem[];
  hiddenOutputs?: Record<string, boolean>;
  onToggleOutput?: (outputName: string) => void;
}

export const OutputsGroup: React.FC<OutputsGroupProps> = ({
  outputs,
  hiddenOutputs = {},
  onToggleOutput
}) => {
  if (outputs.length === 0) return null;
  return (
    <div className={styles.stackColPadded}>
      {outputs.map((output) => {
        const isHidden = hiddenOutputs[output.name] ?? false;

        return (
          <div key={output.name} className={styles.inputWithToggle}>
            {onToggleOutput && (
              <Icon
                onClick={() => onToggleOutput(output.name)}
                title={isHidden ? 'Show output on node' : 'Hide output on node'}
              >
                {isHidden ? <EyeClosed /> : <EyeSolid />}
              </Icon>
            )}
            <div className={styles.inputControlWrapper}>
              <div className={styles.inputRow}>
                <div className={styles.inputMeta}>
                  <div className={styles.inputName} title={output.valueType}>
                    {output.name}
                  </div>
                  <div className={styles.inputSubtext}>
                    {output.connected ? 'Connected' : output.valueType}
                  </div>
                </div>
                <div>
                  {output.connected ? (
                    <div className={styles.connectedMessage}>
                      Socket is connected
                    </div>
                  ) : (
                    <div className={styles.connectedMessage}>Not connected</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
