import { NodeCategory, type NodeSpecJSON } from '@kiberon-labs/behave-graph';
import cx from 'classnames';
import React, { type PropsWithChildren } from 'react';

import { categoryColorMap } from '../../../util/colors.js';

import styles from './NodeContainer.module.css';

type NodeProps = {
  title: string;
  category?: NodeSpecJSON['category'];
  selected?: boolean;
  titleBarActions?: React.ReactElement;
};

const NodeContainer: React.FC<PropsWithChildren<NodeProps>> = ({
  title,
  category = NodeCategory.None,
  selected,
  titleBarActions,
  children
}) => {
  let colorName = categoryColorMap[category];
  if (colorName === undefined) {
    colorName = 'red';
  }

  const colorClass = styles[colorName];
  const hasActions = Boolean(titleBarActions);

  return (
    <div
      className={cx(styles.container, colorClass, selected && styles.selected)}
    >
      <div className={styles.header}>
        <div className={styles.title}>{title}</div>
        {hasActions && (
          <div className={cx(styles.actions, 'nodrag')}>{titleBarActions}</div>
        )}
      </div>
      <div className={styles.content}>{children}</div>
    </div>
  );
};

export default NodeContainer;
