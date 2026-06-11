import React from 'react';
import styles from './icon.module.css';
import classNames from 'classnames';

interface IconProps extends React.HTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  title?: string;
  disabled?: boolean;
  className?: string;
  size?: 'small' | 'medium' | 'large';
}

export const Icon: React.FC<IconProps> = ({
  children,
  onClick,
  title,
  disabled = false,
  className,
  size = 'small'
}) => {
  return (
    <button
      className={classNames(
        styles.icon,
        styles[size],
        disabled && styles.disabled,
        className
      )}
      onClick={onClick}
      disabled={disabled}
      title={title}
      type="button"
    >
      {children}
    </button>
  );
};
