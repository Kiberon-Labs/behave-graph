import type { System } from '@/system/system';
import type { Renderable, Toast } from 'react-hot-toast';

export type NotificationType = 'info' | 'success' | 'error' | 'loading';


export interface NotificationData {
  type: NotificationType;
  message: string;
  options?: {
    id?: string;
    duration?: number;
    position?: any;
    icon?: Renderable;
    style?: React.CSSProperties;
    className?: string;
    ariaLive?: any;
  };
}
export interface NotificationOptions {
  /**
   * Toast ID for programmatic dismissal
   */
  id?: string;
  /**
   * Duration in milliseconds. Set to Infinity to persist until manually dismissed
   */
  duration?: number;
  /**
   * Position on screen
   */
  position?: Toast['position'];
  /**
   * Custom icon
   */
  icon?: Renderable;
  /**
   * Custom styles
   */
  style?: React.CSSProperties;
  /**
   * Custom class name
   */
  className?: string;
  /**
   * Accessible aria-live value
   */
  ariaLive?: Toast['ariaProps'];
}

export class Notifications {
  private readonly system: System;
  constructor(system: System) {
    this.system = system;
  }
  /**
   * Dismiss a specific toast or all toasts
   */
  dismissNotification(toastId?: string): void {
    this.system.pubsub.publish('notification:dismiss', { toastId });
  }

  /**
   * Show a notification toast
   */
  notify(
    message: string,
    type: NotificationType = 'info',
    options?: NotificationOptions
  ): void {
    this.system.pubsub.publish('notification', {
      type,
      message,
      options
    });
  }

  /**
   * Show a success notification
   */
  success(message: string, options?: NotificationOptions): void {
    this.notify(message, 'success', options);
  }

  /**
   * Show an error notification
   */
  error(message: string, options?: NotificationOptions): void {
    this.notify(message, 'error', options);
  }

  /**
   * Show a loading notification
   */
  loading(message: string, options?: NotificationOptions): void {
    this.notify(message, 'loading', options);
  }

  /**
   * Show an info notification
   */
  info(message: string, options?: NotificationOptions): void {
    this.notify(message, 'info', options);
  }

  /**
   * Dismiss a specific toast or all toasts
   */
  dismiss(toastId?: string): void {
    this.system.pubsub.publish('notification:dismiss', { toastId });
  }
}
