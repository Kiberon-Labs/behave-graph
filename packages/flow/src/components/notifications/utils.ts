import type { ToastOptions } from 'react-hot-toast';
import type { PubSub } from '@/system/pubsub';

export interface NotificationData {
  type: 'success' | 'error' | 'info' | 'loading';
  message: string;
  options?: ToastOptions;
}

/**
 * Emit a success notification
 */
export function notifySuccess(
  pubsub: PubSub,
  message: string,
  options?: ToastOptions
): void {
  pubsub.publish('notification', {
    type: 'success',
    message,
    options
  });
}

/**
 * Emit an error notification
 */
export function notifyError(
  pubsub: PubSub,
  message: string,
  options?: ToastOptions
): void {
  pubsub.publish('notification', {
    type: 'error',
    message,
    options
  });
}

/**
 * Emit an info notification
 */
export function notifyInfo(
  pubsub: PubSub,
  message: string,
  options?: ToastOptions
): void {
  pubsub.publish('notification', {
    type: 'info',
    message,
    options
  });
}

/**
 * Emit a loading notification
 */
export function notifyLoading(
  pubsub: PubSub,
  message: string,
  options?: ToastOptions
): string {
  pubsub.publish('notification', {
    type: 'loading',
    message,
    options
  });
  // Note: In a real implementation, you'd return the toast ID
  // For now, we return a dummy ID since the pubsub is fire-and-forget
  return `toast_${Date.now()}`;
}
