'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { GameService, Game } from '../../../../services/gameService';
import { Chess, Square } from 'chess.js';

export default function GamePage() {
  const { gameId } = useParams();
  const router = useRouter();
  const { user, isSignedIn, isLoaded } = useUser();
  const [game, setGame] = useState<Game | null>(null);
  const [chessInstance, setChessInstance] = useState<Chess | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [possibleMoves, setPossibleMoves] = useState<Square[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [myColor, setMyColor] = useState<'white' | 'black' | null>(null);
  const [socket, setSocket] = useState<any>(null);
  const [showDrawOffer, setShowDrawOffer] = useState(false);
  const [drawOfferedByMe, setDrawOfferedByMe] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [gameResult, setGameResult] = useState<string | null>(null);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user || !gameId) {
      return;
    }

    // Load game details
    loadGame();
    
    // Connect to socket server
    const newSocket = GameService.connectToSocket(user.id);
    setSocket(newSocket);
    
    // Set up socket event listeners
    newSocket.on('game:updated', handleGameUpdated);
    newSocket.on('game:drawOffered', handleDrawOffered);
    newSocket.on('game:drawResponded', handleDrawResponded);
    newSocket.on('game:ended', handleGameEnded);
    
    // Cleanup on unmount
    return () => {
      if (newSocket) {
        newSocket.off('game:updated', handleGameUpdated);
        newSocket.off('game:drawOffered', handleDrawOffered);
        newSocket.off('game:drawResponded', handleDrawResponded);
        newSocket.off('game:ended', handleGameEnded);
        GameService.disconnectFromSocket();
      }
    };
  }, [isLoaded, isSignedIn, user, gameId]);

  // Update chess instance when game board changes
  useEffect(() => {
    if (game?.board) {
      const chess = new Chess(game.board);
      setChessInstance(chess);
      
      // Set game over state
      const isGameOver = ['checkmate', 'stalemate', 'draw', 'resigned'].includes(game.status);
      setGameOver(isGameOver);
      
      // Set game result message
      if (isGameOver) {
        let result = '';
        
        if (game.status === 'checkmate') {
          const winnerColor = game.turn === 'white' ? 'Black' : 'White';
          result = `Checkmate! ${winnerColor} wins`;
        } else if (game.status === 'stalemate') {
          result = 'Stalemate! The game is a draw';
        } else if (game.status === 'draw') {
          result = 'Draw agreed';
        } else if (game.status === 'resigned') {
          const resigner = game.players.find(p => p.userId !== game.winner);
          result = `${resigner?.username || 'Opponent'} resigned`;
        }
        
        setGameResult(result);
      }
    }
  }, [game?.board, game?.status, game?.turn, game?.winner]);

  // Determine if it's the current user's turn and their color
  useEffect(() => {
    if (game && user) {
      const player = game.players.find(p => p.userId === user.id);
      if (player) {
        setMyColor(player.color);
        setIsMyTurn(game.turn === player.color);
      }
    }
  }, [game, user]);

  // Load or refresh game details
  const loadGame = async () => {
    try {
      setLoading(true);
      const gameData = await GameService.getGameDetails(gameId as string);
      setGame(gameData);
      setError(null);
      
      // Play sound when it's your turn and game was just updated (not initial load)
      if (game && gameData.turn !== game.turn) {
        // Only play sound if the document is visible
        if (document.visibilityState === 'visible' && audioRef.current) {
          audioRef.current.play().catch(e => console.log('Audio play prevented:', e));
        }
      }
    } catch (err: any) {
      console.error('Error loading game:', err);
      setError(err.message || 'Failed to load game');
    } finally {
      setLoading(false);
    }
  };

  // Handle socket event for game update
  const handleGameUpdated = (data: { gameId: string, gameState: Game }) => {
    if (data.gameId === gameId) {
      setGame(data.gameState);
    }
  };

  // Handle socket event for draw offer
  const handleDrawOffered = (data: { gameId: string, offeringUserId: string }) => {
    if (data.gameId === gameId && data.offeringUserId !== user?.id) {
      setShowDrawOffer(true);
      setDrawOfferedByMe(false);
    }
  };

  // Handle socket event for draw response
  const handleDrawResponded = (data: { gameId: string, accepted: boolean }) => {
    if (data.gameId === gameId) {
      // If you offered the draw, clear that state
      setDrawOfferedByMe(false);
      
      if (!data.accepted) {
        alert('Draw offer declined');
      }
      // If accepted, the game:updated event will handle updating the game state
    }
  };

  // Handle socket event for game end
  const handleGameEnded = (data: { gameId: string, reason: string, winner?: string, gameState: Game }) => {
    if (data.gameId === gameId) {
      setGame(data.gameState);
    }
  };

  // Handle board square click
  const handleSquareClick = (square: Square) => {
    if (gameOver || !isMyTurn || !chessInstance) {
      return;
    }

    // If a square is already selected
    if (selectedSquare) {
      // Try to make a move
      if (possibleMoves.includes(square)) {
        makeMove(selectedSquare, square);
      } else {
        // Check if the new square has a piece of the player's color
        const piece = chessInstance.get(square);
        if (piece && piece.color === (myColor === 'white' ? 'w' : 'b')) {
          // Select the new square
          setSelectedSquare(square);
          // Update possible moves
          const moves = chessInstance.moves({ square, verbose: true });
          setPossibleMoves(moves.map(move => move.to as Square));
        } else {
          // Clear selection if clicking on empty square or opponent's piece
          setSelectedSquare(null);
          setPossibleMoves([]);
        }
      }
    } else {
      // Check if the square has a piece of the player's color
      const piece = chessInstance.get(square);
      if (piece && piece.color === (myColor === 'white' ? 'w' : 'b')) {
        // Select the square
        setSelectedSquare(square);
        // Get possible moves for this piece
        const moves = chessInstance.moves({ square, verbose: true });
        setPossibleMoves(moves.map(move => move.to as Square));
      }
    }
  };

  // Make a move
  const makeMove = async (from: Square, to: Square) => {
    if (!gameId || !user?.id || !chessInstance) return;

    try {
      // First check if this is a pawn promotion
      const piece = chessInstance.get(from);
      const isPromotion = piece && 
                         piece.type === 'p' && 
                         ((piece.color === 'w' && to[1] === '8') || 
                          (piece.color === 'b' && to[1] === '1'));
      
      // Handle promotion (simplified - always promotes to queen)
      const promotion = isPromotion ? 'q' : undefined;
      
      // Call API to make the move
      await GameService.makeMove(gameId as string, user.id, { 
        from, 
        to,
        promotion 
      });
      
      // Clear selection
      setSelectedSquare(null);
      setPossibleMoves([]);
      
      // Note: We don't need to update the game state here as the socket event will handle that
    } catch (err: any) {
      console.error('Error making move:', err);
      setError(err.message || 'Failed to make move');
    }
  };

  // Handle offer draw
  const handleOfferDraw = async () => {
    if (!gameId || !user?.id) return;

    try {
      await GameService.offerDraw(gameId as string, user.id);
      setDrawOfferedByMe(true);
      // Will wait for response via socket event
    } catch (err: any) {
      console.error('Error offering draw:', err);
      setError(err.message || 'Failed to offer draw');
    }
  };

  // Handle draw offer response
  const handleRespondToDraw = async (accepted: boolean) => {
    if (!gameId || !user?.id) return;

    try {
      await GameService.respondToDraw(gameId as string, user.id, accepted);
      setShowDrawOffer(false);
      // Will receive game update via socket event
    } catch (err: any) {
      console.error('Error responding to draw:', err);
      setError(err.message || 'Failed to respond to draw');
    }
  };

  // Handle resignation
  const handleResign = async () => {
    if (!gameId || !user?.id) return;

    const confirmResign = window.confirm('Are you sure you want to resign?');
    if (!confirmResign) return;

    try {
      await GameService.resign(gameId as string, user.id);
      // Will receive game update via socket event
    } catch (err: any) {
      console.error('Error resigning:', err);
      setError(err.message || 'Failed to resign');
    }
  };

  // Handle return to lobby
  const handleReturnToLobby = () => {
    router.push('/multiplayer');
  };

  // Render a chess square
  const renderSquare = (square: string, index: number) => {
    const row = 8 - Math.floor(index / 8);
    const col = String.fromCharCode(97 + (index % 8));
    const squareName = `${col}${row}` as Square;
    
    // Determine square color
    const isLightSquare = (row + col.charCodeAt(0)) % 2 === 0;
    
    // Determine if this square is selected or a possible move
    const isSelected = selectedSquare === squareName;
    const isPossibleMove = possibleMoves.includes(squareName);
    
    // Get piece on this square
    let pieceChar = '';
    let pieceColor = '';
    
    if (chessInstance) {
      const piece = chessInstance.get(squareName);
      if (piece) {
        pieceChar = piece.type.toUpperCase();
        pieceColor = piece.color === 'w' ? 'text-white' : 'text-black';
      }
    }
    
    // Convert piece character to Unicode chess symbols
    const pieceSymbol = pieceChar ? getPieceSymbol(pieceChar, pieceColor === 'text-white') : '';
    
    // Determine the square's CSS classes
    let squareClasses = isLightSquare ? 'bg-amber-200' : 'bg-amber-800';
    
    if (isSelected) {
      squareClasses += ' ring-2 ring-inset ring-blue-500';
    } else if (isPossibleMove) {
      squareClasses += ' ring-2 ring-inset ring-green-500';
    }
    
    return (
      <div 
        key={squareName}
        className={`w-12 h-12 flex items-center justify-center cursor-pointer ${squareClasses}`}
        onClick={() => handleSquareClick(squareName)}
      >
        {pieceSymbol && (
          <span className={`text-3xl ${pieceColor}`}>{pieceSymbol}</span>
        )}
      </div>
    );
  };

  // Convert piece character to Unicode chess symbol
  const getPieceSymbol = (piece: string, isWhite: boolean): string => {
    const symbols: Record<string, [string, string]> = {
      'P': ['♙', '♟'],
      'R': ['♖', '♜'],
      'N': ['♘', '♞'],
      'B': ['♗', '♝'],
      'Q': ['♕', '♛'],
      'K': ['♔', '♚']
    };
    
    return symbols[piece][isWhite ? 0 : 1];
  };

  // Show loading state if user info or game is still loading
  if (!isLoaded || loading) {
    return <div className="p-6">Loading game...</div>;
  }

  // Require sign-in to access game
  if (isLoaded && !isSignedIn) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold mb-4">Multiplayer Chess</h1>
        <p className="mb-4">You must be signed in to access this game.</p>
        <a href="/sign-in" className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded">
          Sign In
        </a>
      </div>
    );
  }

  // Show error if game couldn't be loaded
  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold mb-4">Error</h1>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
        <button
          onClick={handleReturnToLobby}
          className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded"
        >
          Return to Lobby
        </button>
      </div>
    );
  }

  // Show message if game hasn't started yet
  if (game && game.players.length < 2 && game.status === 'created') {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold mb-4">Waiting for Opponent</h1>
        <p className="mb-4">Share this game ID with your friend: <span className="font-bold">{gameId}</span></p>
        <div className="mb-6 bg-yellow-50 p-4 rounded border border-yellow-200">
          <p>This game will start once another player joins.</p>
        </div>
        <button
          onClick={handleReturnToLobby}
          className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded"
        >
          Return to Lobby
        </button>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-4">Multiplayer Chess</h1>
      
      {/* Game information */}
      <div className="mb-6 grid grid-cols-2 gap-4">
        <div className="bg-white shadow rounded p-4">
          <h2 className="text-lg font-semibold mb-2">Game Status</h2>
          {gameOver ? (
            <div className="font-bold text-lg text-blue-600">{gameResult}</div>
          ) : (
            <div className={`font-bold text-lg ${isMyTurn ? 'text-green-600' : 'text-red-600'}`}>
              {isMyTurn ? "Your Turn" : "Opponent's Turn"}
            </div>
          )}
        </div>
        
        <div className="bg-white shadow rounded p-4">
          <h2 className="text-lg font-semibold mb-2">Players</h2>
          <div className="space-y-1">
            {game?.players.map((player) => (
              <div key={player.userId} className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div 
                    className={`w-3 h-3 rounded-full ${player.color === 'white' ? 'bg-white border border-gray-400' : 'bg-black'}`}
                  ></div>
                  <span className={player.userId === user?.id ? 'font-bold' : ''}>
                    {player.username} {player.userId === user?.id ? '(You)' : ''}
                  </span>
                </div>
                {game.turn === player.color && !gameOver && (
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Playing</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Draw offer notification */}
      {showDrawOffer && (
        <div className="mb-6 bg-yellow-50 p-4 rounded border border-yellow-200 flex justify-between items-center">
          <div className="font-medium">Your opponent has offered a draw</div>
          <div className="space-x-2">
            <button
              onClick={() => handleRespondToDraw(true)}
              className="bg-green-500 hover:bg-green-600 text-white py-1 px-3 rounded"
            >
              Accept
            </button>
            <button
              onClick={() => handleRespondToDraw(false)}
              className="bg-red-500 hover:bg-red-600 text-white py-1 px-3 rounded"
            >
              Decline
            </button>
          </div>
        </div>
      )}
      
      {/* Draw offer sent notification */}
      {drawOfferedByMe && (
        <div className="mb-6 bg-blue-50 p-4 rounded border border-blue-200">
          <div className="font-medium">You have offered a draw. Waiting for your opponent to respond...</div>
        </div>
      )}
      
      {/* Chess board */}
      <div className="mb-6">
        <div className="grid grid-cols-8 w-fit border border-gray-800">
          {Array(64).fill(null).map((_, index) => renderSquare('', index))}
        </div>
      </div>
      
      {/* Game controls */}
      <div className="flex space-x-4">
        {!gameOver && (
          <>
            <button
              onClick={handleOfferDraw}
              disabled={drawOfferedByMe || !isMyTurn}
              className={`py-2 px-4 rounded ${
                drawOfferedByMe || !isMyTurn
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-yellow-500 hover:bg-yellow-600 text-white'
              }`}
            >
              Offer Draw
            </button>
            <button
              onClick={handleResign}
              className="bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded"
            >
              Resign
            </button>
          </>
        )}
        <button
          onClick={handleReturnToLobby}
          className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded"
        >
          Return to Lobby
        </button>
      </div>
      
      {/* Sound effect for turn notification */}
      <audio ref={audioRef} src="/move-sound.mp3" preload="auto" />
    </div>
  );
}