import styles from './styles.module.css';

export const BasePanel = ({ children }: { children: React.ReactNode }) => {
  return <div className={styles.root}>{children}</div>;
};
