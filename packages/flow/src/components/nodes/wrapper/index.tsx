import React, { useMemo } from 'react';
import styles from './styles.module.css';
import { ErrorBoundary } from 'react-error-boundary';
import classNames from 'classnames';
import {
  annotatedTitle,
  description,
  executing,
  hidden,
  pinned
} from '@/annotations';
import { MessageText, PinSolid } from 'iconoir-react';

interface NodeProps {
  icon?: React.ReactNode;
  subtitle?: string;
  error?: Error | null;
  isAsync?: boolean;
  children?: React.ReactNode;
  controls?: React.ReactNode;
  style?: React.CSSProperties;
  metadata?: Record<string, any>;
}

export const BaseNodeWrapper = (props: NodeProps) => {
  const { icon, metadata, subtitle, error, children, controls, ...rest } =
    props;

  const title = metadata?.[annotatedTitle];
  const isExecuting = metadata?.[executing];
  const isHidden = metadata?.[hidden];
  const isPinned = metadata?.[pinned];
  const hasDescription = metadata?.[description];

  return (
    <ErrorBoundary fallback={<div>Error occurred</div>}>
      <div
        className={classNames(
          styles.nodeWrapper,
          error && styles.error,
          isExecuting && styles.executing,
          isHidden && styles.hidden,
          isPinned && styles.pinned
        )}
      >
        <div
          className={classNames(!isPinned && 'reactflow-draggable-handle')}
          {...rest}
        >
          <div className={styles.header}>
            <div className={styles.headerContent}>
              {icon}
              <div className={styles.titleContainer}>
                <span className={styles.title}>{title}</span>
                {subtitle && (
                  <span className={styles.subtitle}>{subtitle}</span>
                )}
              </div>
            </div>
            <div className={styles.controls}>{controls}</div>
            <div className={styles.icons}>
              {hasDescription && <MessageText className={styles.smallIcon} />}
              {isPinned && <PinSolid className={styles.smallIcon} />}
            </div>
          </div>

          <div />
          {children}
        </div>
      </div>
    </ErrorBoundary>
  );
};
