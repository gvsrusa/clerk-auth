// Set up Jest testing environment
import '@testing-library/jest-dom';

// Mock window.matchMedia for tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock HTMLMediaElement for audio testing
window.HTMLMediaElement.prototype.load = jest.fn();
window.HTMLMediaElement.prototype.play = jest.fn().mockImplementation(() => Promise.resolve());
window.HTMLMediaElement.prototype.pause = jest.fn();
window.HTMLMediaElement.prototype.addTextTrack = jest.fn();

// Mock localStorage
const localStorageMock = (function() {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn().mockImplementation((key: string) => {
      return store[key] || null;
    }),
    setItem: jest.fn().mockImplementation((key: string, value: string) => {
      store[key] = value.toString();
    }),
    removeItem: jest.fn().mockImplementation((key: string) => {
      delete store[key];
    }),
    clear: jest.fn().mockImplementation(() => {
      store = {};
    }),
    key: jest.fn().mockImplementation((index: number) => {
      return Object.keys(store)[index] || null;
    }),
    get length() {
      return Object.keys(store).length;
    }
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Set environment variables for tests
process.env.JEST_WORKER_ID = '1';

// Suppress console errors/warnings during tests to keep the output clean
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Add a custom matcher for chess positions
expect.extend({
  toBeValidChessPosition(received) {
    // Basic FEN validation
    const validFEN = typeof received === 'string' && 
                     received.includes('/') && 
                     (received.includes('w') || received.includes('b'));
    
    return {
      message: () =>
        `expected ${received} to be a valid chess position`,
      pass: validFEN,
    };
  },
});