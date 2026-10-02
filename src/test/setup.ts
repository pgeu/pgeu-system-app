import { afterEach, vi, beforeAll, afterAll } from 'vitest';
import { cleanup, configure } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Don't pretty-print the DOM into failed query errors. Ionic 8.8+ ships
// minified components whose classes are anonymous, and Testing Library's
// DOM printer doesn't recognise elements with an empty constructor.name, so
// it serialises them as plain objects. That takes seconds per failed query
// and ends in "Invalid string length", which hangs every waitFor() retry.
configure({
  getElementError: (message) => {
    const error = new Error(message ?? undefined);
    error.name = 'TestingLibraryElementError';
    return error;
  },
});

// Cleanup after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Mock Capacitor plugins
vi.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: () => 'web',
    isNativePlatform: () => false,
    isPluginAvailable: () => false,
  },
  registerPlugin: vi.fn(),
  CapacitorHttp: {
    get: vi.fn(),
    post: vi.fn(),
    request: vi.fn(),
  },
}));

vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
    clear: vi.fn(),
    keys: vi.fn(),
    migrate: vi.fn(),
  },
}));

vi.mock('@capacitor/barcode-scanner', () => ({
  CapacitorBarcodeScanner: {
    scanBarcode: vi.fn(),
  },
  CapacitorBarcodeScannerTypeHint: {
    QR_CODE: 0,
    ALL: 17,
  },
}));

vi.mock('@capacitor-mlkit/barcode-scanning', () => ({
  BarcodeScanner: {
    scan: vi.fn(),
    isSupported: vi.fn(),
    checkPermissions: vi.fn(),
    requestPermissions: vi.fn(),
  },
}));

vi.mock('@capacitor/app', () => ({
  App: {
    addListener: vi.fn(),
    getLaunchUrl: vi.fn(),
    removeAllListeners: vi.fn(),
  },
}));

// Mock IntersectionObserver (required for some Ionic components)
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
} as any;

// Mock matchMedia (used for responsive/dark mode)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Suppress console errors in tests (optional, remove if you want to see all errors)
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});
