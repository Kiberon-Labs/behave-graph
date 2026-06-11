import React from 'react';
import { VscodeCollapsible } from '@vscode-elements/react-elements';
import type {
  SocketGenerator,
  SocketGeneratorNode
} from '@/store/socketGenerator';
import styles from './index.module.css';

interface SocketGeneratorsProps {
  generators: SocketGenerator[];
  generatorNode: SocketGeneratorNode;
}

export const SocketGenerators: React.FC<SocketGeneratorsProps> = ({
  generators,
  generatorNode
}) => {
  if (generators.length === 0) return null;

  return (
    <VscodeCollapsible title="Socket Generator" open>
      <div className={styles.stackColPadded}>
        {generators.map((generator) => {
          const GeneratorRenderer = generator.render;
          return (
            <GeneratorRenderer key={generator.name} node={generatorNode} />
          );
        })}
      </div>
    </VscodeCollapsible>
  );
};
