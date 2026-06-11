# Notification System

The notification system in `@kiberon-labs/behave-graph-flow` provides a simple way to display toast notifications throughout the application using react-hot-toast and a pubsub event-driven architecture.

## Architecture

The notification system consists of three main parts:

1. **NotificationProvider** - React component that subscribes to notification events and renders toasts
2. **Notification utilities** - Helper functions for publishing notification events
3. **PubSub integration** - Event-based communication system

## Setup

The `NotificationProvider` is automatically included in the `Flow` component, so no additional setup is required.

## Usage

### Basic Notifications

Import the notification utilities from the package:

```typescript
import { notifySuccess, notifyError, notifyInfo, notifyLoading } from '@kiberon-labs/behave-graph-flow';
import { useSystem } from '@kiberon-labs/behave-graph-flow';

function MyComponent() {
  const system = useSystem();
  
  const handleSuccess = () => {
    notifySuccess(system, 'Operation completed successfully');
  };
  
  const handleError = () => {
    notifyError(system, 'Something went wrong');
  };
  
  const handleInfo = () => {
    notifyInfo(system, 'Here is some information');
  };
  
  const handleLoading = () => {
    notifyLoading(system, 'Processing...');
  };
  
  return (
    // ... your component
  );
}
```

### Advanced Options

All notification functions accept an optional `options` parameter:

```typescript
notifySuccess(system, 'Custom notification', {
  duration: 5000,              // Duration in milliseconds
  id: 'unique-id',             // Custom ID for programmatic dismissal
  icon: '🎉',                  // Custom icon
  position: 'top-center',      // Position on screen
  style: {                     // Custom styles
    background: '#333',
    color: '#fff'
  },
  className: 'my-toast'        // Custom CSS class
});
```

### Persistent Notifications

Create notifications that persist until manually dismissed:

```typescript
const notificationId = 'persistent-notification';

notifyInfo(system, 'This will stay until dismissed', {
  id: notificationId,
  duration: Infinity
});

// Dismiss later
dismissNotification(system, notificationId);
```

### Async Operations with Loading States

```typescript
async function saveGraph() {
  const loadingId = 'save-operation';
  
  notifyLoading(system, 'Saving graph...', { id: loadingId });
  
  try {
    await performSave();
    dismissNotification(system, loadingId);
    notifySuccess(system, 'Graph saved successfully');
  } catch (error) {
    dismissNotification(system, loadingId);
    notifyError(system, 'Failed to save graph');
  }
}
```

### Direct PubSub Usage

You can also publish notifications directly via the pubsub system:

```typescript
system.pubsub.publish('notification', {
  type: 'success',
  message: 'Direct notification',
  options: {
    duration: 3000
  }
});

// Dismiss all notifications
system.pubsub.publish('notification:dismiss', {});

// Dismiss specific notification
system.pubsub.publish('notification:dismiss', { toastId: 'specific-id' });
```

## API Reference

### Notification Functions

#### `notify(system, message, type, options?)`
Generic notification function.

- **system**: `System` - The behave-graph system instance
- **message**: `string` - The notification message
- **type**: `'info' | 'success' | 'error' | 'loading'` - Notification type
- **options**: `NotificationOptions` - Optional configuration

#### `notifySuccess(system, message, options?)`
Show a success notification (green with checkmark icon).

#### `notifyError(system, message, options?)`
Show an error notification (red with error icon).

#### `notifyInfo(system, message, options?)`
Show an info notification (default styling).

#### `notifyLoading(system, message, options?)`
Show a loading notification (with spinner icon).

#### `dismissNotification(system, toastId?)`
Dismiss a specific notification by ID, or all notifications if no ID provided.

### NotificationOptions

```typescript
interface NotificationOptions {
  id?: string;                    // Custom ID for the toast
  duration?: number;              // Duration in ms (default: 4000)
  position?: ToastPosition;       // Position on screen
  icon?: string | React.ReactNode;  // Custom icon
  style?: React.CSSProperties;    // Custom inline styles
  className?: string;             // Custom CSS class
  ariaLive?: 'polite' | 'assertive' | 'off';  // Accessibility
}
```

### Toast Positions

- `'top-left'`
- `'top-center'`
- `'top-right'`
- `'bottom-left'`
- `'bottom-center'`
- `'bottom-right'` (default)

## PubSub Events

The notification system uses the following pubsub events:

### `notification`
Emitted when a new notification should be displayed.

```typescript
{
  type: 'success' | 'error' | 'info' | 'loading',
  message: string,
  options?: NotificationOptions
}
```

### `notification:dismiss`
Emitted when a notification should be dismissed.

```typescript
{
  toastId?: string  // Omit to dismiss all
}
```

## Styling

The notification system uses CSS variables for theming to match your application's design:

- `--colors-bgSecondary`: Background color
- `--colors-text`: Text color
- `--colors-border`: Border color
- `--colors-success`: Success icon color
- `--colors-error`: Error icon color

You can override the default styles by passing custom styles in the options:

```typescript
notifySuccess(system, 'Custom styled', {
  style: {
    background: '#your-color',
    color: '#your-text-color',
    border: '1px solid #your-border-color'
  }
});
```

## Examples

See [examples/notifications.ts](../examples/notifications.ts) for comprehensive usage examples.

## Best Practices

1. **Use appropriate notification types** - Choose the right type (success, error, info, loading) to match the context
2. **Keep messages concise** - Toast notifications should be brief and to the point
3. **Dismiss loading notifications** - Always dismiss loading notifications when the operation completes
4. **Use unique IDs for persistence** - When creating persistent notifications, use unique IDs for easy dismissal
5. **Consider timing** - Default duration is 4000ms (4 seconds), adjust based on message importance
6. **Avoid notification spam** - Don't overwhelm users with too many notifications at once

## Troubleshooting

### Styling issues

1. Ensure your CSS variables are defined
2. Check that custom styles are valid CSS properties
3. Verify className exists if using custom classes

### Notifications not dismissing

1. Ensure you're using the correct toast ID when dismissing
2. Check that `dismissNotification` is being called
3. Verify the notification wasn't created with `duration: Infinity` without a dismiss call
