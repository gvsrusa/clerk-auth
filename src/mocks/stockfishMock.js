// Mock implementation of the stockfish module for testing

const mockStockfishEngine = {
  postMessage: jest.fn(),
  onmessage: jest.fn(),
};

const stockfish = jest.fn(() => mockStockfishEngine);

module.exports = stockfish;