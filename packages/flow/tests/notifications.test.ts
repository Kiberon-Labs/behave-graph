import { describe, it, expect, beforeEach, vi } from 'vitest';
import { System } from '@/system/system';
import {
  notifySuccess,
  notifyError,
  notifyInfo,
  notifyLoading
} from '@/components/notifications/utils';

describe('Notification System', () => {
  let system: System;
  let publishSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    system = new System();
    publishSpy = vi.spyOn(system.pubsub, 'publish');
  });

  describe('notifySuccess', () => {
    it('should publish success notification', () => {
      const message = 'Success!';

      notifySuccess(system.pubsub, message);

      expect(publishSpy).toHaveBeenCalledWith('notification', {
        type: 'success',
        message,
        options: undefined
      });
    });

    it('should include options when provided', () => {
      const message = 'Success with options!';
      const options = { duration: 5000, id: 'test-id' };

      notifySuccess(system.pubsub, message, options);

      expect(publishSpy).toHaveBeenCalledWith('notification', {
        type: 'success',
        message,
        options
      });
    });
  });

  describe('notifyError', () => {
    it('should publish error notification', () => {
      const message = 'Error!';

      notifyError(system.pubsub, message);

      expect(publishSpy).toHaveBeenCalledWith('notification', {
        type: 'error',
        message,
        options: undefined
      });
    });
  });

  describe('notifyInfo', () => {
    it('should publish info notification', () => {
      const message = 'Info!';

      notifyInfo(system.pubsub, message);

      expect(publishSpy).toHaveBeenCalledWith('notification', {
        type: 'info',
        message,
        options: undefined
      });
    });
  });

  describe('notifyLoading', () => {
    it('should publish loading notification', () => {
      const message = 'Loading...';

      notifyLoading(system.pubsub, message);

      expect(publishSpy).toHaveBeenCalledWith('notification', {
        type: 'loading',
        message,
        options: undefined
      });
    });
  });
});
