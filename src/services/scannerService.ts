/**
 * Scanner Service
 * Wraps Capacitor ML Kit BarcodeScanner plugin and provides unified scanning interface
 */

import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import type { ScannerError, ScanResult } from '../types/scanner';
import { parseQRCode } from '../utils/tokenValidator';
import { redactTokens } from '../utils/redact';

/**
 * Scanner service for QR code scanning operations
 */
export class ScannerService {
  private scanListener: (() => void) | null = null;

  /**
   * Check if barcode scanning is supported on this device
   */
  async isSupported(): Promise<boolean> {
    try {
      const result = await BarcodeScanner.isSupported();
      return result.supported;
    } catch (error) {
      console.error('Failed to check scanner support:', error);
      return false;
    }
  }

  /**
   * Check camera permission status
   */
  async checkPermission(): Promise<'granted' | 'denied' | 'prompt'> {
    try {
      const result = await BarcodeScanner.checkPermissions();
      if (result.camera === 'granted') {
        return 'granted';
      } else if (result.camera === 'denied') {
        return 'denied';
      }
      return 'prompt';
    } catch (error) {
      console.error('Failed to check permissions:', error);
      return 'prompt';
    }
  }

  /**
   * Request camera permission
   */
  async requestPermission(): Promise<'granted' | 'denied' | 'prompt'> {
    try {
      const result = await BarcodeScanner.requestPermissions();
      if (result.camera === 'granted') {
        return 'granted';
      } else if (result.camera === 'denied') {
        return 'denied';
      }
      return 'prompt';
    } catch (error) {
      console.error('Failed to request permissions:', error);
      return 'denied';
    }
  }

  /**
   * Start scanning for QR codes
   *
   * @param onScan - Callback when a valid QR code is detected
   * @param onError - Callback when an error occurs
   * @returns Cleanup function to stop scanning
   */
  async startScan(
    onScan: (result: ScanResult) => void,
    onError: (error: ScannerError) => void
  ): Promise<() => void> {
    console.log('[ScannerService] startScan called');
    try {
      // Start scanning with ML Kit
      console.log('[ScannerService] Calling BarcodeScanner.scan()');
      const result = await BarcodeScanner.scan();

      console.log('[ScannerService] scan completed, barcodes:', result.barcodes?.length ?? 0);

      // Handle scan result
      if (result.barcodes && result.barcodes.length > 0) {
        const scannedValue = result.barcodes[0].rawValue;
        console.log('[ScannerService] Barcode found:', redactTokens(scannedValue));
        const parsedCode = parseQRCode(scannedValue);

        if (parsedCode) {
          console.log('[ScannerService] Valid parsed code, calling onScan callback');
          onScan({
            parsedCode,
            timestamp: Date.now(),
          });
        } else {
          console.log('[ScannerService] Invalid parsed code, calling onError callback');
          onError({
            type: 'invalid_qr_code',
            message: 'The scanned code is not a valid conference QR code',
            details: scannedValue,
          });
        }
      } else {
        console.log('[ScannerService] No barcodes in response');
      }

      // Return cleanup function
      console.log('[ScannerService] Returning cleanup function');
      return () => {
        // Cleanup if needed
      };
    } catch (error) {
      console.error('[ScannerService] Scanner error:', error);

      // Check if user denied permissions
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log('[ScannerService] Error message:', errorMessage);
      if (errorMessage.toLowerCase().includes('permission')) {
        console.log('[ScannerService] Permission denied error detected');
        onError({
          type: 'permission_denied',
          message: 'Camera permission is required to scan QR codes',
          details: 'Please enable camera access in your device settings',
        });
      } else {
        console.log('[ScannerService] Unknown error detected');
        onError({
          type: 'unknown',
          message: errorMessage || 'An unknown error occurred',
        });
      }
      return () => {};
    }
  }

  /**
   * Stop scanning (for future use if we implement continuous scanning)
   */
  async stopScan(): Promise<void> {
    // Plugin stops automatically after each scan
    // This method is a placeholder for future enhancements
    if (this.scanListener) {
      this.scanListener();
      this.scanListener = null;
    }
  }

  /**
   * Prepare the scanner (check permissions and support)
   *
   * @returns Object with ready state and error if any
   */
  async prepare(): Promise<{ ready: true } | { ready: false; error: ScannerError }> {
    console.log('[ScannerService] prepare called');
    // Check if supported
    const supported = await this.isSupported();
    console.log('[ScannerService] isSupported result:', supported);
    if (!supported) {
      console.log('[ScannerService] Scanner not supported');
      return {
        ready: false,
        error: {
          type: 'unsupported',
          message: 'QR code scanning is not supported on this device',
        },
      };
    }

    // Plugin handles permissions automatically when scanning starts
    // So we just return ready
    console.log('[ScannerService] Scanner ready');
    return { ready: true };
  }
}

// Export singleton instance
export const scannerService = new ScannerService();
