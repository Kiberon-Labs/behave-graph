import React, { useMemo } from 'react';
import styles from './styles.module.css';
import { ErrorBoundary } from 'react-error-boundary';
import classNames from 'classnames';
import { annotatedTitle } from '@/annotations';

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

export const Collapser = ({ children, collapsed }) => {
  const isCollapsed = useMemo(() => collapsed, [collapsed]);

  return (
    <div className={isCollapsed ? styles.collapserContainer : ''}>
      <div className={styles.collapserContent}>{children}</div>
    </div>
  );
};

export const BaseNodeWrapper = (props: NodeProps) => {
  const { icon, metadata, subtitle, error, children, controls, ...rest } =
    props;

  const title = metadata?.[annotatedTitle];

  return (
    <ErrorBoundary fallback={<div>Error occurred</div>}>
      <div className={`${styles.nodeWrapper} ${error ? styles.error : ''}`}>
        <div className="flex flex-col reactflow-draggable-handle" {...rest}>
          {title && (
            <>
              <div
                className={classNames(
                  styles.header,
                  'flex flex-row justify-between items-center'
                )}
              >
                <div className="flex flex-row gap-2 items-center">
                  {icon}
                  <div className="flex flex-col">
                    <span className={styles.title}>{title}</span>
                    {subtitle && (
                      <span className={styles.subtitle}>{subtitle}</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-row gap-2">{controls}</div>
              </div>
            </>
          )}
          {children}
        </div>
      </div>
    </ErrorBoundary>
  );
};
