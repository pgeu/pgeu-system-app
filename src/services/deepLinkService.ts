/**
 * Deep link service for handling conference URLs from app opens
 * Integrates with Capacitor App plugin to process URLs
 */

import { App, URLOpenListenerEvent } from '@capacitor/app';
import { Capacitor, PluginListenerHandle } from '@capacitor/core';

export interface DeepLinkHandler {
  /**
   * Callback function to handle a deep link URL
   * @param url - The deep link URL to process
   * @returns Promise resolving to true if handled successfully
   */
  (url: string): Promise<boolean>;
}

export interface DeepLinkResult {
  success: boolean;
  url: string;
  error?: string;
}

/**
 * Service for managing deep links
 */
export class DeepLinkService {
  private handler: DeepLinkHandler | null = null;
  private listener: PluginListenerHandle | null = null;

  // Bumped by every initialize() and destroy(), so that a call which
  // finishes after a newer one has started cannot undo the newer one's work
  private generation = 0;

  // On a cold start the launch URL arrives twice: from App.getLaunchUrl(),
  // and as an appUrlOpen event that the App plugin retains until the first
  // listener registers. Handle whichever arrives first and skip the other.
  private launchUrlPromise: Promise<string | null> | null = null;
  private launchUrlSeen = 0;
  private launchCheck: Promise<DeepLinkResult | null> | null = null;

  /**
   * Initialize deep link handling
   * @param handler - Function to call when a deep link is received
   */
  async initialize(handler: DeepLinkHandler): Promise<void> {
    const generation = ++this.generation;
    this.handler = handler;

    // Only set up listener on native platforms
    if (!Capacitor.isNativePlatform()) {
      console.warn('Deep linking is only available on native platforms');
      return;
    }

    // Set up listener for app URL opens
    const listener = await App.addListener('appUrlOpen', async (event: URLOpenListenerEvent) => {
      return await this.handleUrlOpen(event);
    });

    if (generation !== this.generation) {
      // destroy() or another initialize() ran whilst we were waiting
      await listener.remove();
      return;
    }
    this.listener = listener;
  }

  /**
   * Clean up deep link listener
   */
  async destroy(): Promise<void> {
    this.generation++;
    const listener = this.listener;
    this.listener = null;
    this.handler = null;
    if (listener) {
      await listener.remove();
    }
  }

  private getLaunchUrl(): Promise<string | null> {
    if (!this.launchUrlPromise) {
      this.launchUrlPromise = App.getLaunchUrl().then(result => result?.url || null);
    }
    return this.launchUrlPromise;
  }

  /**
   * Whether this delivery of a URL is the second copy of the launch URL
   */
  private async isDuplicateLaunchUrl(url: string): Promise<boolean> {
    let launchUrl: string | null;
    try {
      launchUrl = await this.getLaunchUrl();
    } catch {
      return false;
    }
    if (url !== launchUrl || this.launchUrlSeen >= 2) {
      return false;
    }
    this.launchUrlSeen++;
    return this.launchUrlSeen === 2;
  }

  /**
   * Handle a URL open event
   */
  private async handleUrlOpen(event: URLOpenListenerEvent): Promise<DeepLinkResult> {
    const url = event.url;

    if (await this.isDuplicateLaunchUrl(url)) {
      return { success: true, url };
    }

    try {
      if (!this.handler) {
        console.error('No deep link handler registered');
        return {
          success: false,
          url,
          error: 'No handler registered',
        };
      }

      const success = await this.handler(url);

      return {
        success,
        url,
      };
    } catch (error) {
      console.error('Error handling deep link:', error);
      return {
        success: false,
        url,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check if the app was launched with a URL (for initial app launch).
   * The launch URL is only processed once; later calls return the same result.
   * @param handler - Function to call if a launch URL is found
   * @returns Promise resolving to the result
   */
  checkLaunchUrl(handler?: DeepLinkHandler): Promise<DeepLinkResult | null> {
    if (!Capacitor.isNativePlatform()) {
      return Promise.resolve(null);
    }
    if (!this.launchCheck) {
      this.launchCheck = this.processLaunchUrl(handler);
    }
    return this.launchCheck;
  }

  private async processLaunchUrl(handler?: DeepLinkHandler): Promise<DeepLinkResult | null> {
    let launchUrl = '';

    try {
      const url = await this.getLaunchUrl();

      if (!url) {
        return null;
      }

      launchUrl = url;

      if (await this.isDuplicateLaunchUrl(launchUrl)) {
        return { success: true, url: launchUrl };
      }

      const handlerFn = handler || this.handler;

      if (!handlerFn) {
        console.error('No deep link handler available');
        return {
          success: false,
          url: launchUrl,
          error: 'No handler available',
        };
      }

      const success = await handlerFn(launchUrl);

      return {
        success,
        url: launchUrl,
      };
    } catch (error) {
      console.error('Error checking launch URL:', error);
      return {
        success: false,
        url: launchUrl,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// Export singleton instance
export const deepLinkService = new DeepLinkService();
