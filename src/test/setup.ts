import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { vi, afterEach } from 'vitest';

// Mock environment variables before any imports
vi.mock('~/lib/bot/env', () => ({
  env: {
    TG_API_TOKEN: 'test-token-for-testing',
    NODE_ENV: 'test',
    CONVEX_DEPLOYMENT: 'test-deployment',
  },
}));

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock Telegram WebApp SDK
global.Telegram = {
  WebApp: {
    ready: vi.fn(),
    expand: vi.fn(),
    close: vi.fn(),
    MainButton: {
      text: '',
      isVisible: false,
      isActive: false,
      onClick: vi.fn(),
      offClick: vi.fn(),
      show: vi.fn(),
      hide: vi.fn(),
      enable: vi.fn(),
      disable: vi.fn(),
      showProgress: vi.fn(),
      hideProgress: vi.fn(),
    },
    BackButton: {
      isVisible: false,
      onClick: vi.fn(),
      offClick: vi.fn(),
      show: vi.fn(),
      hide: vi.fn(),
    },
    HapticFeedback: {
      impactOccurred: vi.fn(),
      notificationOccurred: vi.fn(),
      selectionChanged: vi.fn(),
    },
    initData: '',
    initDataUnsafe: {
      user: {
        id: 12345,
        first_name: 'Test',
        last_name: 'User',
        username: 'testuser',
      },
    },
  },
};

// Mock Web APIs
global.URL.createObjectURL = vi.fn(() => 'mock-blob-url');
global.URL.revokeObjectURL = vi.fn();

// Mock Worker
const MockWorker = class {
  constructor(url: string) {
    this.url = url;
  }
  url: string;
  onmessage: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  dispatchEvent = vi.fn();
} as any;

global.Worker = MockWorker;

// Mock window object with Worker
global.window = {
  Worker: MockWorker,
} as any;

// Mock MediaRecorder
global.MediaRecorder = vi.fn().mockImplementation((stream, options) => ({
  stream,
  mimeType: options?.mimeType || 'video/webm',
  state: 'inactive',
  start: vi.fn(),
  stop: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  requestData: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  ondataavailable: null,
  onstop: null,
  onerror: null,
  onstart: null,
})) as any;

// Add static method to MediaRecorder mock
(global.MediaRecorder as any).isTypeSupported = vi.fn().mockReturnValue(true);

// Mock Blob
global.Blob = class MockBlob {
  data: any;
  type: string;
  size: number;

  constructor(data: any, options?: { type?: string }) {
    this.data = data;
    this.type = options?.type || '';
    this.size = data ? data.length : 0;
  }

  arrayBuffer() {
    return Promise.resolve(new ArrayBuffer(0));
  }

  text() {
    return Promise.resolve('');
  }

  stream() {
    return new ReadableStream();
  }

  slice() {
    return new MockBlob([]);
  }
} as any;

// Mock File
global.File = class MockFile {
  data: any;
  name: string;
  type: string;
  size: number;
  lastModified: number;

  constructor(data: any, name: string, options?: { type?: string }) {
    this.data = data;
    this.name = name;
    this.type = options?.type || '';
    this.size = data ? data.length : 0;
    this.lastModified = Date.now();
  }

  arrayBuffer() {
    return Promise.resolve(new ArrayBuffer(0));
  }

  text() {
    return Promise.resolve('');
  }

  stream() {
    return new ReadableStream();
  }

  slice() {
    return new MockFile([], '');
  }
} as any;

// Mock FileReader
const MockFileReader = class {
  result: string | ArrayBuffer | null = '';
  error: any = null;
  readyState = 0;
  onload: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  shouldError = false;

  readAsDataURL = vi.fn().mockImplementation(function(this: any, blob: Blob) {
    setTimeout(() => {
      if (this.shouldError) {
        this.readyState = 2; // DONE
        this.error = new Error('Mock FileReader error');
        if (this.onerror) {
          this.onerror({ target: this } as any);
        }
      } else {
        this.result = 'data:video/webm;base64,dGVzdCBkYXRh';
        this.readyState = 2; // DONE
        if (this.onload) {
          this.onload({ target: this } as any);
        }
      }
    }, 0);
  });

  abort = vi.fn();
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  dispatchEvent = vi.fn();
  readAsArrayBuffer = vi.fn().mockImplementation(function(this: any, blob: Blob) {
    setTimeout(() => {
      this.result = new ArrayBuffer(10);
      this.readyState = 2;
      if (this.onload) {
        this.onload({ target: this } as any);
      }
    }, 0);
  });
  readAsBinaryString = vi.fn();
  readAsText = vi.fn().mockImplementation(function(this: any, blob: Blob) {
    setTimeout(() => {
      this.result = 'test data';
      this.readyState = 2;
      if (this.onload) {
        this.onload({ target: this } as any);
      }
    }, 0);
  });

  // Helper method to trigger errors in tests
  setErrorMode(shouldError: boolean) {
    this.shouldError = shouldError;
  }
};

global.FileReader = MockFileReader as any;
globalThis.FileReader = MockFileReader as any;

// Mock document object
Object.defineProperty(global, 'document', {
  value: {
    cookie: '',
  },
  writable: true,
  configurable: true,
});

// Also add to window object for compatibility
if (typeof global.window !== 'undefined') {
  global.window.FileReader = MockFileReader as any;
  global.window.document = global.document;
}