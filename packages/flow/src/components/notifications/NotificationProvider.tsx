import React, { useEffect } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import { useSystem } from '@/system/provider';

/**
 * NotificationProvider listens to pubsub notification events and displays toasts
 */
export const NotificationProvider: React.FC = () => {
  const system = useSystem();

  useEffect(() => {
    // Subscribe to notification events
    const token = system.pubsub.subscribe('notification', (_, data) => {
      const { type, message, options } = data;

      switch (type) {
        case 'success':
          toast.success(message, options);
          break;
        case 'error':
          toast.error(message, options);
          break;
        case 'loading':
          toast.loading(message, options);
          break;
        case 'info':
        default:
          toast(message, options);
          break;
      }
    });

    // Subscribe to notification dismiss events
    const dismissToken = system.pubsub.subscribe(
      'notification:dismiss',
      (_, data) => {
        if (data.toastId) {
          toast.dismiss(data.toastId);
        } else {
          toast.dismiss();
        }
      }
    );

    // Cleanup subscriptions on unmount
    return () => {
      if (token) {
        system.pubsub.unsubscribe(token);
      }
      if (dismissToken) {
        system.pubsub.unsubscribe(dismissToken);
      }
    };
  }, [system.pubsub]);

  return (
    <Toaster
      position="bottom-right"
      toastOptions={{
        duration: 4000,
        style: {
          background: 'var(--colors-bgSecondary, #2a2a2a)',
          color: 'var(--colors-text, #ffffff)',
          border: '1px solid var(--colors-border, #404040)'
        },
        success: {
          iconTheme: {
            primary: 'var(--colors-success, #22c55e)',
            secondary: 'var(--colors-bgSecondary, #2a2a2a)'
          }
        },
        error: {
          iconTheme: {
            primary: 'var(--colors-error, #ef4444)',
            secondary: 'var(--colors-bgSecondary, #2a2a2a)'
          }
        }
      }}
    />
  );
};
