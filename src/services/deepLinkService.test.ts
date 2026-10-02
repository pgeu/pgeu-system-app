import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { DeepLinkService } from './deepLinkService';

// Mock Capacitor
vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(),
  },
}));

describe('DeepLinkService', () => {
  let service: DeepLinkService;
  let mockHandler: ReturnType<typeof vi.fn>;
  let mockListener: any;

  beforeEach(() => {
    service = new DeepLinkService();
    mockHandler = vi.fn().mockResolvedValue(true);
    mockListener = { remove: vi.fn().mockResolvedValue(undefined) };

    // Reset all mocks
    vi.clearAllMocks();

    // Default: simulate native platform
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(App.addListener).mockResolvedValue(mockListener);
  });

  afterEach(async () => {
    await service.destroy();
  });

  describe('initialize', () => {
    it('should set up listener on native platform', async () => {
      await service.initialize(mockHandler);

      expect(App.addListener).toHaveBeenCalledWith(
        'appUrlOpen',
        expect.any(Function)
      );
    });

    it('should not set up listener on web platform', async () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);

      await service.initialize(mockHandler);

      expect(App.addListener).not.toHaveBeenCalled();
    });

    it('should call handler when URL is received', async () => {
      await service.initialize(mockHandler);

      const addListenerCall = vi.mocked(App.addListener).mock.calls[0];
      const eventHandler = addListenerCall[1];

      await eventHandler({ url: 'https://postgresql.eu/events/test/checkin/abc123/' });

      expect(mockHandler).toHaveBeenCalledWith('https://postgresql.eu/events/test/checkin/abc123/');
    });

    it('should handle errors from handler gracefully', async () => {
      const errorHandler = vi.fn().mockRejectedValue(new Error('Test error'));
      await service.initialize(errorHandler);

      const addListenerCall = vi.mocked(App.addListener).mock.calls[0];
      const eventHandler = addListenerCall[1];

      const result = await eventHandler({ url: 'https://test.com/invalid' });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Test error');
    });

    it('should handle missing handler error', async () => {
      // Don't initialize with a handler
      const testService = new DeepLinkService();

      // Manually trigger URL handling
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
      await testService.initialize(mockHandler);

      // Clear the handler
      await testService.destroy();

      // Reinitialize without handler by creating new instance
      const serviceWithoutHandler = new DeepLinkService();
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);

      // Access private method through any type
      const result = await (serviceWithoutHandler as any).handleUrlOpen({
        url: 'https://test.com',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('No handler registered');
    });
  });

  describe('destroy', () => {
    it('should remove listener when destroyed', async () => {
      await service.initialize(mockHandler);
      await service.destroy();

      expect(mockListener.remove).toHaveBeenCalled();
    });

    it('should handle destroy without initialization', async () => {
      await expect(service.destroy()).resolves.not.toThrow();
    });
  });

  describe('checkLaunchUrl', () => {
    it('should return null on web platform', async () => {
      vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);

      const result = await service.checkLaunchUrl(mockHandler);

      expect(result).toBeNull();
      expect(App.getLaunchUrl).not.toHaveBeenCalled();
    });

    it('should return null when no launch URL', async () => {
      vi.mocked(App.getLaunchUrl).mockResolvedValue({ url: null });

      const result = await service.checkLaunchUrl(mockHandler);

      expect(result).toBeNull();
    });

    it('should process launch URL with provided handler', async () => {
      const launchUrl = 'https://postgresql.eu/events/test/checkin/' + 'a'.repeat(40) + '/';
      vi.mocked(App.getLaunchUrl).mockResolvedValue({ url: launchUrl });

      const result = await service.checkLaunchUrl(mockHandler);

      expect(mockHandler).toHaveBeenCalledWith(launchUrl);
      expect(result).toEqual({
        success: true,
        url: launchUrl,
      });
    });

    it('should use initialized handler if no handler provided', async () => {
      const launchUrl = 'https://postgresql.eu/events/test/checkin/' + 'b'.repeat(40) + '/';
      vi.mocked(App.getLaunchUrl).mockResolvedValue({ url: launchUrl });

      service.initialize(mockHandler);
      const result = await service.checkLaunchUrl();

      expect(mockHandler).toHaveBeenCalledWith(launchUrl);
      expect(result?.success).toBe(true);
    });

    it('should return error when no handler available', async () => {
      const launchUrl = 'https://postgresql.eu/events/test/checkin/' + 'c'.repeat(40) + '/';
      vi.mocked(App.getLaunchUrl).mockResolvedValue({ url: launchUrl });

      const result = await service.checkLaunchUrl();

      expect(result?.success).toBe(false);
      expect(result?.error).toBe('No handler available');
    });

    it('should handle errors from getLaunchUrl', async () => {
      vi.mocked(App.getLaunchUrl).mockRejectedValue(new Error('Platform error'));

      const result = await service.checkLaunchUrl(mockHandler);

      expect(result).toEqual({
        success: false,
        url: '',
        error: 'Platform error',
      });
    });

    it('should handle handler errors during launch URL processing', async () => {
      const launchUrl = 'https://postgresql.eu/events/test/checkin/' + 'd'.repeat(40) + '/';
      vi.mocked(App.getLaunchUrl).mockResolvedValue({ url: launchUrl });

      const errorHandler = vi.fn().mockRejectedValue(new Error('Handler failed'));

      const result = await service.checkLaunchUrl(errorHandler);

      expect(result).toEqual({
        success: false,
        url: launchUrl,
        error: 'Handler failed',
      });
    });

    it('should handle handler returning false', async () => {
      const launchUrl = 'https://postgresql.eu/events/test/checkin/invalid/';
      vi.mocked(App.getLaunchUrl).mockResolvedValue({ url: launchUrl });

      const failingHandler = vi.fn().mockResolvedValue(false);

      const result = await service.checkLaunchUrl(failingHandler);

      expect(result).toEqual({
        success: false,
        url: launchUrl,
      });
    });
  });

  describe('integration scenarios', () => {
    it('should handle multiple URL events', async () => {
      service.initialize(mockHandler);

      const addListenerCall = vi.mocked(App.addListener).mock.calls[0];
      const eventHandler = addListenerCall[1];

      const url1 = 'https://postgresql.eu/events/conf1/checkin/' + 'a'.repeat(40) + '/';
      const url2 = 'https://postgresql.eu/events/conf2/checkin/' + 'b'.repeat(40) + '/';

      await eventHandler({ url: url1 });
      await eventHandler({ url: url2 });

      expect(mockHandler).toHaveBeenCalledTimes(2);
      expect(mockHandler).toHaveBeenNthCalledWith(1, url1);
      expect(mockHandler).toHaveBeenNthCalledWith(2, url2);
    });

    it('should keep the new handler when an earlier destroy finishes late', async () => {
      let finishRemove!: () => void;
      mockListener.remove.mockReturnValue(new Promise<void>(resolve => { finishRemove = resolve; }));
      const secondListener = { remove: vi.fn().mockResolvedValue(undefined) };

      await service.initialize(mockHandler);
      const pendingDestroy = service.destroy();
      vi.mocked(App.addListener).mockResolvedValue(secondListener as any);
      await service.initialize(mockHandler);
      finishRemove();
      await pendingDestroy;

      const eventHandler = vi.mocked(App.addListener).mock.calls[1][1];
      const url = 'https://postgresql.eu/events/test/checkin/' + 'e'.repeat(40) + '/';
      const result = await eventHandler({ url });

      expect(result.success).toBe(true);
      expect(mockHandler).toHaveBeenCalledWith(url);
      expect(secondListener.remove).not.toHaveBeenCalled();
    });

    it('should remove a listener whose initialize was overtaken by destroy', async () => {
      const pendingInit = service.initialize(mockHandler);
      await service.destroy();
      await pendingInit;

      expect(mockListener.remove).toHaveBeenCalledTimes(1);
    });

    it('should handle the launch URL once when the listener and check both deliver it', async () => {
      const launchUrl = 'https://postgresql.eu/events/test/checkin/' + 'f'.repeat(40) + '/';
      vi.mocked(App.getLaunchUrl).mockResolvedValue({ url: launchUrl });

      await service.initialize(mockHandler);
      const eventHandler = vi.mocked(App.addListener).mock.calls[0][1];

      await Promise.all([
        eventHandler({ url: launchUrl }),
        service.checkLaunchUrl(mockHandler),
        service.checkLaunchUrl(mockHandler),
      ]);

      expect(mockHandler).toHaveBeenCalledTimes(1);
      expect(App.getLaunchUrl).toHaveBeenCalledTimes(1);

      // A later, warm open of any URL (even the same one) is still handled
      const otherUrl = 'https://postgresql.eu/events/other/checkin/' + 'g'.repeat(40) + '/';
      await eventHandler({ url: otherUrl });
      await eventHandler({ url: launchUrl });

      expect(mockHandler).toHaveBeenCalledTimes(3);
    });

    it('should properly clean up and reinitialize', async () => {
      await service.initialize(mockHandler);
      await service.destroy();

      expect(mockListener.remove).toHaveBeenCalledTimes(1);

      await service.initialize(mockHandler);

      expect(App.addListener).toHaveBeenCalledTimes(2);
    });
  });
});
