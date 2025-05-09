// Mock process.env for tests
process.env.JEST_WORKER_ID = '1';

import StockfishService, { StockfishError, InvalidPositionError } from './stockfishService';

describe('StockfishService', () => {
  let stockfishService: StockfishService;
  
  beforeEach(() => {
    jest.clearAllMocks();
    stockfishService = new StockfishService();
    
    // Force useMockImplementation to true for all tests
    (stockfishService as any).useMockImplementation = true;
    
    // Spy on console methods
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });
  
  describe('initialization', () => {
    it('should initialize with mock engine in test environment', () => {
      expect(stockfishService.engine).toBeDefined();
      expect((stockfishService as any).useMockImplementation).toBe(true);
    });
    
    it('should set default difficulty level to medium', () => {
      expect(stockfishService.currentSkillLevel).toBe(10); // Medium difficulty
    });
  });
  
  describe('setDifficulty', () => {
    it('should set skill level for easy difficulty', () => {
      stockfishService.setDifficulty('easy');
      expect(stockfishService.currentSkillLevel).toBe(5);
    });
    
    it('should set skill level for medium difficulty', () => {
      stockfishService.setDifficulty('medium');
      expect(stockfishService.currentSkillLevel).toBe(10);
    });
    
    it('should set skill level for hard difficulty', () => {
      stockfishService.setDifficulty('hard');
      expect(stockfishService.currentSkillLevel).toBe(20);
    });
  });
  
  describe('getBestMove', () => {
    it('should return a valid move for the starting position', async () => {
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'; // Initial position
      
      // Spy on the private getMockMove method
      const getMockMoveSpy = jest.spyOn(stockfishService as any, 'getMockMove');
      getMockMoveSpy.mockReturnValue('e2e4');
      
      const result = await stockfishService.getBestMove(fen);
      
      expect(result).toBe('e2e4');
      expect(getMockMoveSpy).toHaveBeenCalledWith(fen);
    });
    
    it('should throw an error for invalid FEN string', async () => {
      await expect(stockfishService.getBestMove('')).rejects.toThrow(InvalidPositionError);
    });
    
    it('should use cached result for repeated positions', async () => {
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      
      // Manually set a cache entry
      (stockfishService as any).moveCache.set(fen, 'd2d4');
      
      const result = await stockfishService.getBestMove(fen);
      expect(result).toBe('d2d4');
    });
  });
  
  describe('analyzeMoves', () => {
    it('should provide position analysis with best move and score', async () => {
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      
      // Mock getBestMove to return a consistent result for testing
      jest.spyOn(stockfishService, 'getBestMove').mockResolvedValue('e2e4');
      
      const result = await stockfishService.analyzeMoves(fen);
      
      expect(result).toEqual(expect.objectContaining({
        bestMove: 'e2e4',
        score: expect.any(Number),
        lines: expect.arrayContaining([
          expect.objectContaining({
            move: 'e2e4',
            evaluation: expect.any(Number),
          }),
        ]),
      }));
    });
    
    it('should use cached result for repeated analysis', async () => {
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      
      // Create a mock analysis result
      const mockAnalysis = {
        bestMove: 'e2e4',
        score: 0.5,
        lines: [{ move: 'e2e4', evaluation: 0.5 }],
      };
      
      // Manually set a cache entry
      (stockfishService as any).analysisCache.set(fen, mockAnalysis);
      
      const result = await stockfishService.analyzeMoves(fen);
      expect(result).toEqual(mockAnalysis);
    });
  });
  
  describe('suggestHint', () => {
    it('should provide a quick hint using lower time limit', async () => {
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      
      // Spy on getBestMove to verify it's called with correct time limit
      const getBestMoveSpy = jest.spyOn(stockfishService, 'getBestMove');
      getBestMoveSpy.mockResolvedValue('e2e4');
      
      const hint = await stockfishService.suggestHint(fen);
      
      expect(hint).toBe('e2e4');
      expect(getBestMoveSpy).toHaveBeenCalledWith(fen, 500);
    });
  });
  
  describe('onMessage and offMessage', () => {
    it('should register and remove message handlers', () => {
      const callback = jest.fn();
      
      // Register a handler
      const handlerId = stockfishService.onMessage(callback);
      
      // Verify it was added
      expect((stockfishService as any).messageHandlers[handlerId]).toBeDefined();
      expect((stockfishService as any).messageHandlers[handlerId].callback).toBe(callback);
      
      // Remove the handler
      stockfishService.offMessage(handlerId);
      
      // Verify it was removed
      expect((stockfishService as any).messageHandlers[handlerId]).toBeUndefined();
    });
  });
  
  describe('stop', () => {
    it('should clean up resources when stopped', () => {
      // Add some data to caches
      (stockfishService as any).moveCache.set('test', 'e2e4');
      (stockfishService as any).analysisCache.set('test', { bestMove: 'e2e4', score: 0, lines: [] });
      
      // Add a pending promise
      (stockfishService as any).pendingPromises.push({
        resolve: jest.fn(),
        reject: jest.fn(),
        type: 'bestMove'
      });
      
      // Stop the service
      stockfishService.stop();
      
      // Verify caches were cleared
      expect((stockfishService as any).moveCache.size).toBe(0);
      expect((stockfishService as any).analysisCache.size).toBe(0);
      
      // Verify pending promises were rejected
      expect((stockfishService as any).pendingPromises.length).toBe(0);
    });
  });
  
  describe('error handling', () => {
    it('should wrap errors in StockfishError', async () => {
      // Force an error in getBestMove
      jest.spyOn(stockfishService as any, 'getMockMove').mockImplementation(() => {
        throw new Error('Test error');
      });
      
      await expect(stockfishService.getBestMove('test')).rejects.toThrow(StockfishError);
    });
  });
});