import type React from 'react';
import styles from './SectionTitle.module.css';

/**
 * Compact uppercase section header, shared across panels so every panel renders
 * its groups with the same VSCode-settings-style chrome.
 */
export const SectionTitle = ({
  children
}: {
  children: React.ReactNode;
}) => {
  return <div className={styles.title}>{children}</div>;
};
