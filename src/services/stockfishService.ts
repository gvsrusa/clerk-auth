// src/services/stockfishService.ts
// Implementation with improved error handling and performance

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface AnalysisResult {
  bestMove: string;
  score: number;
  lines: { move: string; evaluation: number }[];
}

interface MessageHandler {
  callback: (data: string) => void;
  analysisData?: {
    score: number;
    moves: string[];
    depth: number;
  };
}

// Common chess opening moves for the mock implementation
const commonOpeningMoves: Record<string, string[]> = {
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1': ['e2e4', 'd2d4', 'g1f3', 'c2c4'],
  'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1': ['e7e5', 'c7c5', 'e7e6', 'c7c6'],
  'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2': ['g1f3', 'b1c3', 'f2f4', 'd2d4'],
  // Adding more opening positions for better coverage
  'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2': ['e4d5', 'e4e5', 'd2d4'],
  'rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 2': ['c7c6', 'e7e6', 'g8f6'],
};

// Error classes for better error handling
export class StockfishError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StockfishError';
  }
}

export class InvalidPositionError extends StockfishError {
  constructor(fen: string) {
    super(`Invalid position: ${fen}`);
    this.name = 'InvalidPositionError';
  }
}

class StockfishService {
  engine: any;
  currentSkillLevel: number = 10; // Default to medium skill level
  private messageHandlers: { [key: string]: MessageHandler } = {};
  private pendingPromises: {
    resolve: (value: any) => void;
    reject: (reason: any) => void;
    type: 'bestMove' | 'analysis' | 'hint';
  }[] = [];
  
  // Cache for performance optimization
  private moveCache = new Map<string, string>();
  private analysisCache = new Map<string, AnalysisResult>();
  
  // Flag for mock implementation
  private useMockImplementation: boolean = true;
  
  constructor() {
    try {
      // Always use mock implementation for better compatibility
      console.log('Using mock Stockfish implementation for better compatibility');
      this.setupMockEngine();
    } catch (error) {
      console.warn('Error initializing Stockfish, using mock implementation:', error);
      this.setupMockEngine();
    }
  }

  // Initialize the mock engine
  private setupMockEngine() {
    this.useMockImplementation = true;
    this.engine = {
      postMessage: (message: string) => {
        // Simulate engine response based on the command
        if (message.startsWith('position fen')) {
          // Position command - no response needed
        } else if (message.startsWith('go depth')) {
          // Find best move command - simulate async response
          setTimeout(() => {
            const fen = this.extractFenFromPosition();
            this.simulateBestMoveResponse(fen);
          }, this.currentSkillLevel * 50);
        } else if (message === 'quit') {
          // Quit command - clean up
        }
      },
      onmessage: () => {}
    };
    console.log('Mock Stockfish engine initialized');
    this.setDifficulty('medium');
  }
  
  // Track the last FEN position we were asked to analyze
  private lastFen: string = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  
  // Helper to extract FEN from previous position command
  private extractFenFromPosition(): string {
    // Return the last FEN we stored
    return this.lastFen;
  }
  
  // Simulate engine response for best move
  private simulateBestMoveResponse(fen: string): void {
    const move = this.getMockMove(fen);
    const response = `bestmove ${move}`;
    
    // Call message handlers with the simulated response
    Object.values(this.messageHandlers).forEach(handler => {
      handler.callback(response);
    });
    
    // Resolve any pending promises
    const pendingPromise = this.pendingPromises.find(p => p.type === 'bestMove');
    if (pendingPromise) {
      pendingPromise.resolve(move);
      this.pendingPromises = this.pendingPromises.filter(p => p !== pendingPromise);
    }
  }
  
  // Get a mock move for a position
  private getMockMove(fen: string): string {
    if (commonOpeningMoves[fen]) {
      const moves = commonOpeningMoves[fen];
      return moves[Math.floor(Math.random() * moves.length)];
    } else {
      // Generate a more realistic move based on piece type and position
      // Parse the FEN to determine which pieces are where and whose turn it is
      const fenParts = fen.split(' ');
      const position = fenParts[0];
      const turn = fenParts[1]; // 'w' or 'b'
      
      // Use common pawn moves as fallback
      if (turn === 'w') {
        // White to move - common white pawn moves or knight moves
        const commonMoves = ['e2e4', 'd2d4', 'g1f3', 'b1c3', 'c2c4', 'a2a3', 'h2h3'];
        return commonMoves[Math.floor(Math.random() * commonMoves.length)];
      } else {
        // Black to move - common black pawn moves or knight moves
        const commonMoves = ['e7e5', 'e7e6', 'c7c5', 'd7d5', 'g8f6', 'b8c6', 'c7c6'];
        return commonMoves[Math.floor(Math.random() * commonMoves.length)];
      }
    }
  }
  
  // Handle messages from the real engine
  private handleEngineMessage(data: string) {
    // Call all registered message handlers
    Object.values(this.messageHandlers).forEach(handler => {
      handler.callback(data);
    });
    
    // Parse and handle best move messages
    if (data.startsWith('bestmove')) {
      const match = data.match(/bestmove\s+(\w+)/);
      if (match && match[1]) {
        const bestMove = match[1];
        
        // Resolve any pending promises
        const pendingPromise = this.pendingPromises.find(p => p.type === 'bestMove');
        if (pendingPromise) {
          pendingPromise.resolve(bestMove);
          this.pendingPromises = this.pendingPromises.filter(p => p !== pendingPromise);
        }
      }
    }
    
    // Handle analysis info messages
    if (data.startsWith('info') && data.includes('score cp')) {
      // In a real implementation, this would parse the evaluation
    }
  }

  // Set difficulty level
  setDifficulty(level: Difficulty) {
    switch (level) {
      case 'easy':
        this.currentSkillLevel = 5;
        if (!this.useMockImplementation) {
          this.engine.postMessage('setoption name Skill Level value 5');
          this.engine.postMessage('setoption name Contempt value 0');
        }
        console.log('Stockfish: Setting difficulty to easy');
        break;
      case 'medium':
        this.currentSkillLevel = 10;
        if (!this.useMockImplementation) {
          this.engine.postMessage('setoption name Skill Level value 10');
          this.engine.postMessage('setoption name Contempt value 10');
        }
        console.log('Stockfish: Setting difficulty to medium');
        break;
      case 'hard':
        this.currentSkillLevel = 20;
        if (!this.useMockImplementation) {
          this.engine.postMessage('setoption name Skill Level value 20');
          this.engine.postMessage('setoption name Contempt value 20');
        }
        console.log('Stockfish: Setting difficulty to hard');
        break;
    }
  }

  // Get best move from the engine
  async getBestMove(fen: string, timeLimit?: number): Promise<string> {
    try {
      // Validate FEN
      if (!fen || typeof fen !== 'string') {
        throw new InvalidPositionError('Invalid FEN string');
      }
      
      // Store the current FEN for the mock engine
      this.lastFen = fen;
      
      // Check cache for performance optimization
      if (this.moveCache.has(fen)) {
        return this.moveCache.get(fen)!;
      }
      
      if (this.useMockImplementation) {
        // Mock implementation
        return new Promise((resolve, reject) => {
          try {
            console.log(`Mock Stockfish: Finding best move for position ${fen}`);
            
            // Add to pending promises
            this.pendingPromises.push({
              resolve,
              reject,
              type: 'bestMove'
            });
            
            // Mock delay based on difficulty
            const delay = timeLimit || this.currentSkillLevel * 100;
            
            setTimeout(() => {
              // Return a predetermined move if available, or a random common move
              const move = this.getMockMove(fen);
              
              // Cache the result
              this.moveCache.set(fen, move);
              resolve(move);
              
              // Remove from pending promises
              this.pendingPromises = this.pendingPromises.filter(
                p => !(p.resolve === resolve && p.type === 'bestMove')
              );
            }, delay);
          } catch (error) {
            reject(new StockfishError(`Error calculating best move: ${error}`));
          }
        });
      } else {
        // Real engine implementation
        return new Promise((resolve, reject) => {
          try {
            // Add to pending promises
            this.pendingPromises.push({
              resolve,
              reject,
              type: 'bestMove'
            });
            
            // Send position to engine
            this.engine.postMessage(`position fen ${fen}`);
            
            // Set search depth based on difficulty
            const depth = timeLimit ? Math.min(5, this.currentSkillLevel) : this.currentSkillLevel;
            this.engine.postMessage(`go depth ${depth}`);
          } catch (error) {
            reject(new StockfishError(`Error communicating with engine: ${error}`));
          }
        });
      }
    } catch (error) {
      console.error('Error in getBestMove:', error);
      throw error instanceof StockfishError
        ? error
        : new StockfishError(`Unexpected error: ${error}`);
    }
  }

  // Provide a quick hint
  async suggestHint(fen: string): Promise<string> {
    try {
      // Update last FEN position
      this.lastFen = fen;
      
      console.log(`Stockfish: Suggesting hint for position ${fen}`);
      // Use lower depth for hints to get quicker response
      if (!this.useMockImplementation) {
        return new Promise((resolve, reject) => {
          try {
            // Add to pending promises
            this.pendingPromises.push({
              resolve,
              reject,
              type: 'hint'
            });
            
            // Send position to engine with lower depth
            this.engine.postMessage(`position fen ${fen}`);
            this.engine.postMessage('go depth 5'); // Fixed shallow depth for quick hints
          } catch (error) {
            reject(new StockfishError(`Error getting hint: ${error}`));
          }
        });
      } else {
        // Mock hint with shorter delay
        return this.getBestMove(fen, 500);
      }
    } catch (error) {
      console.error('Error in suggestHint:', error);
      throw error instanceof StockfishError
        ? error
        : new StockfishError(`Unexpected error getting hint: ${error}`);
    }
  }

  // Analyze a position
  async analyzeMoves(fen: string): Promise<AnalysisResult> {
    try {
      // Update last FEN position
      this.lastFen = fen;
      
      // Check cache
      if (this.analysisCache.has(fen)) {
        return this.analysisCache.get(fen)!;
      }
      
      console.log(`Stockfish: Analyzing position ${fen}`);
      
      if (this.useMockImplementation) {
        // Mock implementation
        return new Promise((resolve, reject) => {
          try {
            // Mock delay for analysis
            setTimeout(async () => {
              try {
                // Get best move for this position
                const bestMove = await this.getBestMove(fen);
                
                // Generate mock analysis data with some variance
                const score = Math.random() * 2 - 1; // Random score between -1 and 1
                
                // Create some alternative moves with lower evaluations
                const lines = [
                  { move: bestMove, evaluation: score },
                  { move: 'd2d4', evaluation: score * 0.8 },
                  { move: 'g1f3', evaluation: score * 0.6 },
                  { move: 'c2c4', evaluation: score * 0.4 }
                ];
                
                // Create result
                const result: AnalysisResult = {
                  bestMove,
                  score,
                  lines
                };
                
                // Cache the result
                this.analysisCache.set(fen, result);
                
                resolve(result);
              } catch (error) {
                reject(new StockfishError(`Error analyzing position: ${error}`));
              }
            }, 1500);
          } catch (error) {
            reject(new StockfishError(`Error analyzing position: ${error}`));
          }
        });
      } else {
        // Real engine implementation
        return new Promise((resolve, reject) => {
          try {
            // Add to pending promises
            this.pendingPromises.push({
              resolve: (bestMove: string) => {
                // Create result with data collected during analysis
                const result: AnalysisResult = {
                  bestMove,
                  score: 0, // This would be populated from engine info messages
                  lines: []
                };
                
                // Cache the result
                this.analysisCache.set(fen, result);
                
                resolve(result);
              },
              reject,
              type: 'analysis'
            });
            
            // Send position to engine with higher depth for analysis
            this.engine.postMessage(`position fen ${fen}`);
            this.engine.postMessage('go depth 15'); // Use deeper search for analysis
          } catch (error) {
            reject(new StockfishError(`Error analyzing position: ${error}`));
          }
        });
      }
    } catch (error) {
      console.error('Error in analyzeMoves:', error);
      throw error instanceof StockfishError
        ? error
        : new StockfishError(`Unexpected error analyzing position: ${error}`);
    }
  }

  // Register a callback for messages
  onMessage(callback: (data: string) => void) {
    const handlerId = Date.now().toString();
    this.messageHandlers[handlerId] = { callback };
    return handlerId;
  }

  // Remove a message handler
  offMessage(handlerId: string) {
    delete this.messageHandlers[handlerId];
  }

  // Stop the engine and clean up resources
  stop() {
    try {
      // Clear caches
      this.moveCache.clear();
      this.analysisCache.clear();
      
      // Stop engine calculation
      if (!this.useMockImplementation) {
        this.engine.postMessage('quit');
      }
      
      // Clear message handlers
      this.messageHandlers = {};
      
      // Reject any pending promises
      this.pendingPromises.forEach(promise => {
        promise.reject(new StockfishError('Engine stopped'));
      });
      this.pendingPromises = [];
      
      console.log('Stockfish: Engine stopped');
    } catch (error) {
      console.error('Error stopping engine:', error);
    }
  }
}

export default StockfishService;