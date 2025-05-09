'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { Chess, Move, Square } from 'chess.js';
import StockfishService, { Difficulty, AnalysisResult } from '@/services/stockfishService';
import { playSound } from '@/utils/audioUtils';
import Link from 'next/link';

// Define types
interface ChessPiece {
  type: string;
  color: 'w' | 'b';
}

interface GameState {
  fen: string;
  isCheck: boolean;
  isCheckmate: boolean;
  isDraw: boolean;
  isStalemate: boolean;
  turn: 'w' | 'b';
  lastMove: Move | null;
  gameOver: boolean;
}

interface SavedGame {
  id: string;
  date: Date;
  pgn: string;
  label: string;
}

// Map piece notation to Unicode chess symbols
const renderPieceSymbol = (piece: ChessPiece): string => {
  const pieces: { [key: string]: string } = {
    'wp': '♙', 'wn': '♘', 'wb': '♗', 'wr': '♖', 'wq': '♕', 'wk': '♔',
    'bp': '♟', 'bn': '♞', 'bb': '♝', 'br': '♜', 'bq': '♛', 'bk': '♚',
  };
  return pieces[`${piece.color}${piece.type}`];
};

// Memoized ChessSquare component to prevent unnecessary re-renders
interface ChessSquareProps {
  square: Square;
  piece: {type: string, color: 'w' | 'b'} | null;
  isSelected: boolean;
  isLegalMove: boolean;
  isLastMove: boolean | null;
  isDarkSquare: boolean;
  rank: number;
  file: string;
  isFirstInRank: boolean;
  isLastInFile: boolean;
  onClick: (square: Square) => void;
  renderPiece: (piece: {type: string, color: 'w' | 'b'}) => string;
}

const ChessSquare = memo(({
  square,
  piece,
  isSelected,
  isLegalMove,
  isLastMove,
  isDarkSquare,
  rank,
  file,
  isFirstInRank,
  isLastInFile,
  onClick,
  renderPiece
}: ChessSquareProps) => {
  return (
    <div
      data-testid={`square-${square}`}
      className={`
        flex items-center justify-center
        ${isDarkSquare ? 'bg-[var(--chess-dark-square)]' : 'bg-[var(--chess-light-square)]'}
        ${isSelected ? 'bg-[var(--chess-selected)]' : ''}
        ${isLegalMove ? 'bg-[var(--chess-legal-move)]' : ''}
        ${isLastMove ? 'bg-[var(--chess-last-move)]' : ''}
        relative
      `}
      style={{ width: '60px', height: '60px' }}
      onClick={() => onClick(square)}
    >
      {piece && (
        <div className="text-4xl">
          {renderPiece(piece)}
        </div>
      )}
      
      {/* Coordinate labels */}
      {isFirstInRank && (
        <div className="absolute top-0 left-1 text-xs">
          {rank}
        </div>
      )}
      {isLastInFile && (
        <div className="absolute bottom-1 right-1 text-xs">
          {file}
        </div>
      )}
      
      {/* Highlight for legal moves */}
      {isLegalMove && !piece && (
        <div className="w-3 h-3 rounded-full bg-[var(--chess-capture)] opacity-70"></div>
      )}
      
      {/* Highlight for captures */}
      {isLegalMove && piece && (
        <div className="absolute inset-0 border-2 border-[var(--chess-capture)] rounded-sm"></div>
      )}
    </div>
  );
});
ChessSquare.displayName = 'ChessSquare';

// Memoized SavedGamesModal component
interface SavedGamesModalProps {
  isVisible: boolean;
  savedGames: SavedGame[];
  onClose: () => void;
  onLoadGame: (game: SavedGame) => void;
}

const SavedGamesModal = memo(({
  isVisible,
  savedGames,
  onClose,
  onLoadGame
}: SavedGamesModalProps) => {
  if (!isVisible) return null;
  
  return (
    <div className="fixed inset-0 bg-[var(--ui-modal-overlay)] flex items-center justify-center p-4 z-50">
      <div className="bg-[var(--ui-modal-bg)] rounded-lg p-6 max-w-md w-full">
        <h2 className="text-xl font-semibold mb-4">Saved Games</h2>
        
        {savedGames.length === 0 ? (
          <p>No saved games found.</p>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            {savedGames.map(game => (
              <div
                key={game.id}
                className="p-3 border-b hover:bg-[var(--ui-hover)] cursor-pointer"
                onClick={() => onLoadGame(game)}
              >
                <p className="font-medium">{game.label}</p>
                <p className="text-sm text-[var(--status-info)]">
                  {game.date.toLocaleDateString()} - {game.date.toLocaleTimeString()}
                </p>
              </div>
            ))}
          </div>
        )}
        
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[var(--btn-secondary-bg)] text-[var(--btn-secondary-text)] rounded hover:bg-[var(--btn-secondary-hover)]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
});
SavedGamesModal.displayName = 'SavedGamesModal';

export default function SinglePlayerGamePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isSignedIn, user } = useUser();
  
  // Get game settings from URL parameters
  const difficulty = (searchParams?.get('difficulty') as Difficulty) || 'medium';
  const playerColor = searchParams?.get('playerColor') || 'white';
  const enableHints = searchParams?.get('hints') === 'true';
  const enableAnalysis = searchParams?.get('analysis') === 'true';
  
  // Stockfish service
  const stockfishServiceRef = useRef<StockfishService | null>(null);
  
  // Chess game state
  const [game, setGame] = useState<Chess | null>(null);
  const [gameState, setGameState] = useState<GameState>({
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    isCheck: false,
    isCheckmate: false,
    isDraw: false,
    isStalemate: false,
    turn: 'w',
    lastMove: null,
    gameOver: false,
  });
  
  // UI state
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [legalMoves, setLegalMoves] = useState<Square[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [isPlayerTurn, setIsPlayerTurn] = useState(playerColor === 'white');
  const [hint, setHint] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [gameHistory, setGameHistory] = useState<Move[]>([]);
  
  // Saved games
  const [savedGames, setSavedGames] = useState<SavedGame[]>([]);
  const [showSavedGames, setShowSavedGames] = useState(false);
  const [gameSaveMessage, setGameSaveMessage] = useState<string | null>(null);
  
  // Play sound when a move is made
  const playMoveSound = useCallback(() => {
    try {
      // Use the utility function to play the sound with Web Audio API
      playSound('/move-sound.mp3').catch((e: Error) => {
        console.error('Error playing move sound:', e);
      });
    } catch (e) {
      console.error('Error setting up move sound:', e);
    }
  }, []);

  // Function to make a computer move
  const makeComputerMove = useCallback(async (chessInstance: Chess) => {
    if (!stockfishServiceRef.current) {
      console.warn('Stockfish service not initialized');
      return;
    }
    
    try {
      setIsThinking(true);
      
      // Get the current FEN position
      const currentFen = chessInstance.fen();
      console.log('Getting computer move for position:', currentFen);
      
      // Get best move from Stockfish with proper error handling
      const bestMove = await stockfishServiceRef.current.getBestMove(currentFen);
      
      // Validate we've got a move from stockfish (in UCI format)
      if (bestMove && bestMove.length >= 4) {
        const from = bestMove.substring(0, 2) as Square;
        const to = bestMove.substring(2, 4) as Square;
        
        // Check if it's a promotion move
        const promotion = bestMove.length > 4 ? bestMove.substring(4, 5) : undefined;
        
        console.log(`Computer moving ${from} to ${to}${promotion ? ' with promotion to ' + promotion : ''}`);
        
        // Make the move with validation
        try {
          const moveResult = chessInstance.move({
            from,
            to,
            promotion,
          });
          
          if (moveResult) {
            // Update the game state with a new Chess instance to ensure proper state update
            const newGame = new Chess(chessInstance.fen());
            setGame(newGame);
            
            // Play move sound with error handling
            playMoveSound();
          } else {
            console.error('Invalid computer move:', from, to);
          }
        } catch (moveError) {
          console.error('Error applying computer move:', moveError);
        }
      } else {
        console.error('Invalid or missing best move from Stockfish:', bestMove);
      }
    } catch (error) {
      console.error('Error making computer move:', error);
    } finally {
      setIsThinking(false);
    }
  }, [playMoveSound]);

  // Initialize the chess game and stockfish engine
  useEffect(() => {
    const chessInstance = new Chess();
    setGame(chessInstance);
    
    // Initialize and configure Stockfish
    stockfishServiceRef.current = new StockfishService();
    stockfishServiceRef.current.setDifficulty(difficulty);
    
    // If player is black, make the first move as white
    if (playerColor === 'black') {
      makeComputerMove(chessInstance);
    }
    
    // Load saved games from localStorage
    const savedGamesJson = localStorage.getItem('singlePlayerSavedGames');
    if (savedGamesJson) {
      try {
        const parsed = JSON.parse(savedGamesJson);
        setSavedGames(parsed.map((game: any) => ({
          ...game,
          date: new Date(game.date)
        })));
      } catch (e) {
        console.error('Error loading saved games:', e);
      }
    }
    
    // Cleanup function
    return () => {
      if (stockfishServiceRef.current) {
        stockfishServiceRef.current.stop();
      }
    };
  }, [difficulty, playerColor, makeComputerMove]);
  
  // Update game state whenever the game changes
  useEffect(() => {
    if (!game) return;
    
    const currentHistory = game.history({ verbose: true });
    
    setGameState({
      fen: game.fen(),
      isCheck: game.inCheck(),
      isCheckmate: game.isCheckmate(),
      isDraw: game.isDraw(),
      isStalemate: game.isStalemate(),
      turn: game.turn() as 'w' | 'b',
      lastMove: currentHistory.length > 0 ? currentHistory[currentHistory.length - 1] : null,
      gameOver: game.isGameOver(),
    });
    
    setGameHistory(currentHistory);
    
    // Determine if it's the player's turn
    setIsPlayerTurn(
      (playerColor === 'white' && game.turn() === 'w') ||
      (playerColor === 'black' && game.turn() === 'b')
    );
    
    // Make computer's move if it's not the player's turn and the game is not over
    if (
      !game.isGameOver() &&
      ((playerColor === 'white' && game.turn() === 'b') ||
       (playerColor === 'black' && game.turn() === 'w')) &&
      !isThinking
    ) {
      makeComputerMove(game);
    }
    
    // Clear any hints or analysis when the game state changes
    setHint(null);
    setAnalysis(null);
  }, [game, playerColor, isThinking, makeComputerMove]);
  
  // Handle square click
  const handleSquareClick = (square: Square) => {
    if (!game || !isPlayerTurn || gameState.gameOver) return;
    
    try {
      // If a square is already selected
      if (selectedSquare) {
        // Try to make a move
        const move = {
          from: selectedSquare,
          to: square,
          // Automatically promote to queen if applicable
          promotion: 'q'
        };
        
        // Check if it's a legal move
        if (legalMoves.includes(square)) {
          const result = game.move(move);
          
          if (result) {
            // Move was successful
            playMoveSound();
            
            // Update game
            setGame(new Chess(game.fen()));
            
            // Reset selection
            setSelectedSquare(null);
            setLegalMoves([]);
            return;
          }
        }
        
        // If we get here, either the move was illegal or we're selecting a new piece
        setSelectedSquare(null);
        setLegalMoves([]);
        
        // If clicked on own piece, select it
        const piece = game.get(square);
        if (piece && isPlayerPiece(piece)) {
          selectPiece(square);
        }
      } else {
        // No square was selected yet, so select this one if it has the player's piece
        const piece = game.get(square);
        if (piece && isPlayerPiece(piece)) {
          selectPiece(square);
        }
      }
    } catch (error) {
      console.error('Error handling square click:', error);
    }
  };
  
  // Helper function to select a piece and show legal moves
  const selectPiece = (square: Square) => {
    if (!game) return;
    
    const moves = game.moves({ square, verbose: true });
    const legalDestinations = moves.map(move => move.to as Square);
    
    setSelectedSquare(square);
    setLegalMoves(legalDestinations);
  };
  
  // Helper function to check if a piece belongs to the player
  const isPlayerPiece = (piece: ChessPiece) => {
    return (playerColor === 'white' && piece.color === 'w') ||
           (playerColor === 'black' && piece.color === 'b');
  };
  
  // This function was moved above makeComputerMove
  
  // Get hint from Stockfish
  const getHint = async () => {
    if (!game || !stockfishServiceRef.current || !enableHints) return;
    
    try {
      setIsThinking(true);
      const suggestedMove = await stockfishServiceRef.current.suggestHint(game.fen());
      
      if (suggestedMove && suggestedMove.length >= 4) {
        const from = suggestedMove.substring(0, 2);
        const to = suggestedMove.substring(2, 4);
        setHint(`${from}-${to}`);
      }
    } catch (error) {
      console.error('Error getting hint:', error);
    } finally {
      setIsThinking(false);
    }
  };
  
  // Get position analysis from Stockfish
  const analyzePosition = async () => {
    if (!game || !stockfishServiceRef.current || !enableAnalysis) return;
    
    try {
      setIsAnalyzing(true);
      const analysisResult = await stockfishServiceRef.current.analyzeMoves(game.fen());
      setAnalysis(analysisResult);
    } catch (error) {
      console.error('Error analyzing position:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  // Undo the last move (both player and computer moves)
  const undoMove = () => {
    if (!game || gameHistory.length < 2) return;
    
    // Undo twice to revert both the computer's and player's moves
    game.undo();
    game.undo();
    
    // Update the game
    setGame(new Chess(game.fen()));
  };
  
  // Save the current game
  const saveGame = () => {
    if (!game) return;
    
    const pgn = game.pgn();
    const newSavedGame: SavedGame = {
      id: `game_${Date.now()}`,
      date: new Date(),
      pgn,
      label: `Game ${savedGames.length + 1}`
    };
    
    // Add to saved games
    const updatedSavedGames = [...savedGames, newSavedGame];
    setSavedGames(updatedSavedGames);
    
    // Store in localStorage
    localStorage.setItem('singlePlayerSavedGames', JSON.stringify(updatedSavedGames));
    
    // Show confirmation message
    setGameSaveMessage('Game Saved');
    setTimeout(() => setGameSaveMessage(null), 3000);
  };
  
  // Load a saved game
  const loadGame = (savedGame: SavedGame) => {
    if (!game) return;
    
    // Create a new chess instance with the saved PGN
    const loadedGame = new Chess();
    
    try {
      loadedGame.loadPgn(savedGame.pgn);
      setGame(loadedGame);
      setShowSavedGames(false);
    } catch (error) {
      console.error('Error loading saved game:', error);
    }
  };
  
  // Start a new game
  const newGame = () => {
    const chessInstance = new Chess();
    setGame(chessInstance);
    
    // If player is black, make the first move as white
    if (playerColor === 'black') {
      makeComputerMove(chessInstance);
    }
  };
  
  // Map piece notation to Unicode chess symbols
  const renderPiece = useCallback((piece: {type: string, color: 'w' | 'b'}) => {
    const pieces: { [key: string]: string } = {
      'wp': '♙', 'wn': '♘', 'wb': '♗', 'wr': '♖', 'wq': '♕', 'wk': '♔',
      'bp': '♟', 'bn': '♞', 'bb': '♝', 'br': '♜', 'bq': '♛', 'bk': '♚',
    };
    return pieces[`${piece.color}${piece.type}`];
  }, []);

  // Calculate board orientation based on player color
  const ranks = useMemo(() =>
    playerColor === 'white' ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8],
    [playerColor]
  );
  
  const files = useMemo(() =>
    playerColor === 'white' ? ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] : ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a'],
    [playerColor]
  );

  // Memoize board squares to prevent unnecessary re-renders
  const squares = useMemo(() => {
    if (!game) return [];
    
    return ranks.flatMap(rank =>
      files.map(file => {
        const square = `${file}${rank}` as Square;
        const rawPiece = game.get(square);
        // Convert to our expected piece format or null
        const piece = rawPiece ? {
          type: rawPiece.type,
          color: rawPiece.color as 'w' | 'b'
        } : null;
        
        const isSelected = selectedSquare === square;
        const isLegalMove = legalMoves.includes(square);
        const isLastMove = gameState.lastMove ?
          (gameState.lastMove.from === square || gameState.lastMove.to === square) :
          null;
        
        // Determine square color
        const isDarkSquare = (rank + file.charCodeAt(0)) % 2 === 0;
        
        return (
          <ChessSquare
            key={square}
            square={square}
            piece={piece}
            isSelected={isSelected}
            isLegalMove={isLegalMove}
            isLastMove={isLastMove}
            isDarkSquare={isDarkSquare}
            rank={rank}
            file={file}
            isFirstInRank={file === files[0]}
            isLastInFile={rank === ranks[ranks.length - 1]}
            onClick={handleSquareClick}
            renderPiece={renderPiece}
          />
        );
      })
    );
  }, [game, selectedSquare, legalMoves, gameState.lastMove, files, ranks, handleSquareClick, renderPiece]);

  // Render the chessboard
  const renderBoard = useCallback(() => {
    if (!game) return null;
    
    return (
      <div
        className="grid grid-cols-8 border border-[var(--ui-border)] shadow-lg"
        style={{ width: '480px', height: '480px' }}
        data-testid="chessboard"
      >
        {squares}
      </div>
    );
  }, [game, squares]);
  
  // Game status message
  const getStatusMessage = () => {
    if (gameState.isCheckmate) {
      return `Checkmate - ${
        ((gameState.turn === 'w' && playerColor === 'black') || 
         (gameState.turn === 'b' && playerColor === 'white')) 
        ? 'You Win' 
        : 'Computer Wins'
      }`;
    }
    
    if (gameState.isStalemate) {
      return 'Stalemate - Draw';
    }
    
    if (gameState.isDraw) {
      return 'Draw';
    }
    
    if (gameState.isCheck) {
      return 'Check!';
    }
    
    return `${gameState.turn === 'w' ? 'White' : 'Black'}'s Turn`;
  };
  
  // Human-readable move notation
  const formatMove = (move: Move | null) => {
    if (!move) return '';
    return `${move.from}-${move.to}`;
  };
  
  // Error boundary component to catch rendering errors
  class ChessErrorBoundary extends React.Component<
    { children: React.ReactNode },
    { hasError: boolean; error: Error | null }
  > {
    constructor(props: { children: React.ReactNode }) {
      super(props);
      this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error) {
      return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
      console.error("Chess component error:", error, errorInfo);
    }

    render() {
      if (this.state.hasError) {
        return (
          <div className="p-4 bg-[var(--status-error-bg)] border border-[var(--status-error-border)] text-[var(--status-error)] rounded-md">
            <h3 className="text-lg font-semibold mb-2">Something went wrong</h3>
            <p className="mb-4">There was an error rendering the chess game.</p>
            <button
              className="bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] px-4 py-2 rounded-md hover:bg-[var(--btn-primary-hover)]"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              Try again
            </button>
          </div>
        );
      }

      return this.props.children;
    }
  }

  // Memoize game controls to prevent unnecessary re-renders
  const GameControls = memo(() => (
    <div className="bg-[var(--ui-hover)] p-4 rounded-lg">
      <h2 className="text-xl font-semibold mb-3">Game Controls</h2>
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={newGame}
          className="bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] px-4 py-2 rounded-md hover:bg-[var(--btn-primary-hover)]"
          disabled={isThinking}
        >
          New Game
        </button>
        <button
          onClick={undoMove}
          className="bg-[var(--btn-secondary-bg)] text-[var(--btn-secondary-text)] px-4 py-2 rounded-md hover:bg-[var(--btn-secondary-hover)]"
          disabled={gameHistory.length < 2 || isThinking}
        >
          Undo
        </button>
        <button
          onClick={saveGame}
          className="bg-[var(--btn-success-bg)] text-[var(--btn-success-text)] px-4 py-2 rounded-md hover:bg-[var(--btn-success-hover)]"
          disabled={isThinking}
        >
          Save Game
        </button>
        <button
          onClick={() => setShowSavedGames(true)}
          className="bg-[var(--btn-success-bg)] text-[var(--btn-success-text)] px-4 py-2 rounded-md hover:bg-[var(--btn-success-hover)]"
          disabled={isThinking}
        >
          Load Game
        </button>
      </div>
      {gameSaveMessage && (
        <p className="text-[var(--status-success)] mt-2 text-center">{gameSaveMessage}</p>
      )}
    </div>
  ));
  GameControls.displayName = 'GameControls';

  // Memoize assistance component
  const AssistancePanel = memo(() => (
    <div className="bg-[var(--ui-hover)] p-4 rounded-lg">
      <h2 className="text-xl font-semibold mb-3">Assistance</h2>
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={getHint}
          className={`px-4 py-2 rounded-md ${
            enableHints
              ? 'bg-[var(--btn-feature-bg)] text-[var(--btn-feature-text)] hover:bg-[var(--btn-feature-hover)]'
              : 'bg-[var(--btn-disabled-bg)] text-[var(--btn-disabled-text)] cursor-not-allowed'
          }`}
          disabled={!enableHints || isThinking || !isPlayerTurn || gameState.gameOver}
        >
          Hint
        </button>
        <button
          onClick={analyzePosition}
          className={`px-4 py-2 rounded-md ${
            enableAnalysis
              ? 'bg-[var(--btn-feature-bg)] text-[var(--btn-feature-text)] hover:bg-[var(--btn-feature-hover)]'
              : 'bg-[var(--btn-disabled-bg)] text-[var(--btn-disabled-text)] cursor-not-allowed'
          }`}
          disabled={!enableAnalysis || isAnalyzing || gameState.gameOver}
        >
          Analyze
        </button>
      </div>
      
      {hint && (
        <div className="mt-3 p-2 bg-[var(--ui-card-bg)] rounded">
          <p>Suggested move: {hint}</p>
        </div>
      )}
      
      {isAnalyzing && <p className="mt-2 text-[var(--status-info)]">Analyzing position...</p>}
      
      {analysis && (
        <div className="mt-3 p-2 bg-[var(--ui-card-bg)] rounded">
          <p>Best move: {analysis.bestMove.substring(0, 2)}-{analysis.bestMove.substring(2, 4)}</p>
          <p>Evaluation: {analysis.score > 0 ? '+' : ''}{analysis.score.toFixed(1)}</p>
          {analysis.lines.length > 0 && (
            <div className="mt-1">
              <p className="text-sm font-semibold">Top lines:</p>
              <ul className="text-xs">
                {analysis.lines.slice(0, 3).map((line, index) => (
                  <li key={index}>
                    {line.move.substring(0, 2)}-{line.move.substring(2, 4)}: {line.evaluation > 0 ? '+' : ''}{line.evaluation.toFixed(1)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  ));
  AssistancePanel.displayName = 'AssistancePanel';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--ui-hover)] p-4">
      <div className="bg-[var(--ui-card-bg)] rounded-lg shadow-lg p-6 max-w-4xl w-full">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Game board and info */}
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold mb-4">Single Player Chess</h1>
            <div className="mb-4 flex items-center justify-between">
              <span className="font-semibold">Difficulty: {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}</span>
              <span className="font-semibold">Playing as: {playerColor}</span>
            </div>
            
            {/* Board with error boundary */}
            <ChessErrorBoundary>
              {renderBoard()}
            </ChessErrorBoundary>
            
            {/* Game status */}
            <div className="mt-4 flex justify-between items-center">
              <div>
                <p className="font-semibold">{getStatusMessage()}</p>
                {gameState.lastMove && (
                  <p>Last Move: {formatMove(gameState.lastMove)}</p>
                )}
              </div>
              {isThinking && (
                <p className="text-[var(--status-info)]">Computer is thinking...</p>
              )}
            </div>
          </div>
          
          {/* Controls and analysis */}
          <div className="flex flex-col space-y-6">
            {/* Game controls */}
            <GameControls />
            
            {/* Assistance */}
            <AssistancePanel />
            
            {/* Navigation */}
            <div className="mt-auto">
              <Link
                href="/single-player"
                className="block text-center bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover)] text-[var(--btn-secondary-text)] py-2 px-4 rounded"
              >
                Back to Settings
              </Link>
              <Link
                href="/"
                className="block text-center mt-2 text-[var(--status-info)] hover:underline"
              >
                Return to Home
              </Link>
            </div>
          </div>
        </div>
      </div>
      
      {/* Saved Games Modal using memoized component */}
      <SavedGamesModal
        isVisible={showSavedGames}
        savedGames={savedGames}
        onClose={() => setShowSavedGames(false)}
        onLoadGame={loadGame}
      />
    </div>
  );
}