import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SinglePlayerGamePage from './page';

// Mock the router with searchParams
const mockSearchParams = new URLSearchParams('difficulty=medium&playerColor=white&hints=true&analysis=true');
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    back: jest.fn(),
  }),
  useSearchParams: () => mockSearchParams,
}));

// Mock Clerk auth
const mockUseUser = jest.fn();
jest.mock('@clerk/nextjs', () => ({
  useUser: () => mockUseUser(),
}));

// Mock the StockfishService
const mockGetBestMove = jest.fn();
const mockSetDifficulty = jest.fn();
const mockSuggestHint = jest.fn();
const mockAnalyzeMoves = jest.fn();
const mockStop = jest.fn();

jest.mock('@/services/stockfishService', () => {
  return jest.fn().mockImplementation(() => ({
    getBestMove: mockGetBestMove,
    setDifficulty: mockSetDifficulty,
    suggestHint: mockSuggestHint,
    analyzeMoves: mockAnalyzeMoves,
    stop: mockStop,
  }));
});

// Mock the Chess.js library
jest.mock('chess.js', () => {
  return {
    Chess: jest.fn().mockImplementation(() => ({
      fen: jest.fn().mockReturnValue('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'),
      turn: jest.fn().mockReturnValue('w'),
      isGameOver: jest.fn().mockReturnValue(false),
      isCheckmate: jest.fn().mockReturnValue(false),
      isDraw: jest.fn().mockReturnValue(false),
      isStalemate: jest.fn().mockReturnValue(false),
      isThreefoldRepetition: jest.fn().mockReturnValue(false),
      isInsufficientMaterial: jest.fn().mockReturnValue(false),
      in_check: jest.fn().mockReturnValue(false),
      pgn: jest.fn().mockReturnValue(''),
      history: jest.fn().mockReturnValue([]),
      moves: jest.fn().mockReturnValue(['e4', 'e5', 'Nf3']),
      move: jest.fn().mockImplementation((move) => {
        if (move === 'e4' || move === { from: 'e2', to: 'e4' }) {
          return { color: 'w', from: 'e2', to: 'e4', piece: 'p' };
        }
        if (move === 'e5' || move === { from: 'e7', to: 'e5' }) {
          return { color: 'b', from: 'e7', to: 'e5', piece: 'p' };
        }
        return null;
      }),
      undo: jest.fn(),
      load_pgn: jest.fn().mockReturnValue(true),
    })),
  };
});

describe('Single Player Game Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseUser.mockReturnValue({
      isSignedIn: true,
      user: {
        id: 'user123',
        username: 'testplayer',
        getFullName: () => 'Test Player',
      },
    });
    
    // Mock StockfishService responses
    mockGetBestMove.mockResolvedValue('e7e5');
    mockSuggestHint.mockResolvedValue('e2e4');
    mockAnalyzeMoves.mockResolvedValue({
      bestMove: 'e2e4',
      score: 0.5,
      lines: [{ move: 'e2e4', evaluation: 0.5 }]
    });
  });

  it('should render the chessboard with correct initial setup', async () => {
    render(<SinglePlayerGamePage />);
    
    // Check for chessboard
    expect(screen.getByTestId('chessboard')).toBeInTheDocument();
    
    // Check difficulty display
    expect(screen.getByText(/Difficulty: Medium/i)).toBeInTheDocument();
    
    // Verify Stockfish service was initialized with correct difficulty
    expect(mockSetDifficulty).toHaveBeenCalledWith('medium');
  });

  it('should allow making moves with proper turn handling', async () => {
    render(<SinglePlayerGamePage />);
    
    // Simulate player making a move (white)
    const e2Square = screen.getByTestId('square-e2');
    const e4Square = screen.getByTestId('square-e4');
    
    fireEvent.click(e2Square); // Select the pawn
    fireEvent.click(e4Square); // Move it to e4
    
    // Verify move was made
    expect(waitFor(() => {
      expect(screen.getByText(/Last Move: e2-e4/i)).toBeInTheDocument();
    }));
    
    // Verify that the AI was asked for a response
    expect(mockGetBestMove).toHaveBeenCalled();
    
    // After AI responds, should show AI move
    await waitFor(() => {
      expect(screen.getByText(/Last Move: e7-e5/i)).toBeInTheDocument();
    });
  });

  it('should display hints when enabled and requested', async () => {
    render(<SinglePlayerGamePage />);
    
    // Find and click the hint button
    const hintButton = screen.getByText(/Hint/i);
    fireEvent.click(hintButton);
    
    // Check that hint service was called
    expect(mockSuggestHint).toHaveBeenCalled();
    
    // Hint should be displayed
    await waitFor(() => {
      expect(screen.getByText(/Suggested move: e2-e4/i)).toBeInTheDocument();
    });
  });

  it('should provide position analysis when enabled', async () => {
    render(<SinglePlayerGamePage />);
    
    // Find and click the analyze button
    const analyzeButton = screen.getByText(/Analyze/i);
    fireEvent.click(analyzeButton);
    
    // Check that analysis service was called
    expect(mockAnalyzeMoves).toHaveBeenCalled();
    
    // Analysis results should be displayed
    await waitFor(() => {
      expect(screen.getByText(/Best move: e2-e4/i)).toBeInTheDocument();
      expect(screen.getByText(/Evaluation: \+0.5/i)).toBeInTheDocument();
    });
  });

  it('should support undo/redo functionality', async () => {
    render(<SinglePlayerGamePage />);
    
    // Make a move first
    const e2Square = screen.getByTestId('square-e2');
    const e4Square = screen.getByTestId('square-e4');
    fireEvent.click(e2Square);
    fireEvent.click(e4Square);
    
    // Wait for AI response
    await waitFor(() => {
      expect(screen.getByText(/Last Move: e7-e5/i)).toBeInTheDocument();
    });
    
    // Find and click the undo button (should undo both AI and player moves)
    const undoButton = screen.getByText(/Undo/i);
    fireEvent.click(undoButton);
    
    // Should be back to initial position
    expect(screen.queryByText(/Last Move:/i)).not.toBeInTheDocument();
  });

  it('should support saving and loading games', async () => {
    render(<SinglePlayerGamePage />);
    
    // Find and click save button
    const saveButton = screen.getByText(/Save Game/i);
    fireEvent.click(saveButton);
    
    // Should display confirmation
    expect(screen.getByText(/Game Saved/i)).toBeInTheDocument();
    
    // Find and click load button
    const loadButton = screen.getByText(/Load Game/i);
    fireEvent.click(loadButton);
    
    // Should display saved games
    expect(screen.getByText(/Saved Games/i)).toBeInTheDocument();
  });

  it('should recognize and display game end states', async () => {
    // Mock game over state
    const chessJsMock = require('chess.js');
    chessJsMock.Chess.mockImplementation(() => ({
      fen: jest.fn().mockReturnValue('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'),
      turn: jest.fn().mockReturnValue('w'),
      isGameOver: jest.fn().mockReturnValue(true),
      isCheckmate: jest.fn().mockReturnValue(true),
      isDraw: jest.fn().mockReturnValue(false),
      isStalemate: jest.fn().mockReturnValue(false),
      isThreefoldRepetition: jest.fn().mockReturnValue(false),
      isInsufficientMaterial: jest.fn().mockReturnValue(false),
      in_check: jest.fn().mockReturnValue(true),
      pgn: jest.fn().mockReturnValue('1.e4 e5 2.Qh5 Nc6 3.Bc4 Nf6 4.Qxf7#'),
      history: jest.fn().mockReturnValue([]),
      moves: jest.fn().mockReturnValue([]),
      move: jest.fn(),
      undo: jest.fn(),
      load_pgn: jest.fn().mockReturnValue(true),
    }));
    
    render(<SinglePlayerGamePage />);
    
    // Should display checkmate
    expect(screen.getByText(/Checkmate/i)).toBeInTheDocument();
    expect(screen.getByText(/You Win/i)).toBeInTheDocument();
    
    // New game button should be available
    expect(screen.getByText(/New Game/i)).toBeInTheDocument();
  });

  it('should clean up resources when unmounting', () => {
    const { unmount } = render(<SinglePlayerGamePage />);
    
    // Unmount the component
    unmount();
    
    // Should call stop() on the Stockfish service
    expect(mockStop).toHaveBeenCalled();
  });
});