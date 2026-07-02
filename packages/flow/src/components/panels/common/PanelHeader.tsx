import type React from 'react';
import styles from './PanelHeader.module.css';

/**
 * A panel section header row: a compact uppercase title (matching SectionTitle)
 * on the left with an optional actions slot (e.g. a "+" button) on the right.
 * Shared so Variables, Events and similar panels render identical chrome.
 */
export const PanelHeader = ({
  title,
  actions
}: {
  title: React.ReactNode;
  actions?: React.ReactNode;
}) => {
  return (
    <div className={styles.header}>
      <span className={styles.title}>{title}</span>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </div>
  );
};
