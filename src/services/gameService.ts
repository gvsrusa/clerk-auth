// src/services/gameService.ts
import { io, Socket } from 'socket.io-client';
import { Chess, Move, PieceSymbol, Square } from 'chess.js';

// Define our game data types
export interface Player {
  id: string;
  userId: string;
  username: string;
  color: 'white' | 'black';
}

export interface Game {
  id: string;
  players: Player[];
  status: GameStatus;
  type: 'public' | 'private';
  createdBy: string;
  createdAt: Date;
  turn: 'white' | 'black';
  board?: string; // FEN string representation of the board
  history?: Move[];
  pgn?: string;
  winner?: string;
  drawOfferedBy?: string;
  invitedUser?: string;
  timeSinceCreation?: string; // For display in the lobby
  gameId?: string; // For compatibility with test expectations
}

export type GameStatus = 'created' | 'active' | 'checkmate' | 'stalemate' | 'draw' | 'resigned' | 'pending_invite';

// In a real app, this would be connected to a database
// For now, we'll simulate with in-memory storage
const games: Map<string, Game> = new Map();
let socket: Socket | null = null;

class UserNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserNotFoundError';
  }
}

// Simulate a user database with a few mock users
const mockUsers = new Map([
  ['user_A_id', { id: 'user_A_id', username: 'UserA' }],
  ['user_B_id', { id: 'user_B_id', username: 'UserB' }],
  ['user_C_id', { id: 'user_C_id', username: 'UserC' }],
]);

// Helper to get a username from userId (in a real app, this would be a DB lookup)
const getUsernameById = (userId: string) => {
  const user = mockUsers.get(userId);
  return user ? user.username : userId.substring(0, 8); // Fallback to truncated ID if not found
};

// Helper to get a userId from username (in a real app, this would be a DB lookup)
const getUserIdByUsername = (username: string) => {
  for (const [id, user] of mockUsers.entries()) {
    if (user.username === username) {
      return id;
    }
  }
  return null;
};

// Helper to format time since creation
const formatTimeSince = (date: Date) => {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + ' years ago';
  
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + ' months ago';
  
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + ' days ago';
  
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + ' hours ago';
  
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + ' minutes ago';
  
  return Math.floor(seconds) + ' seconds ago';
};

export const GameService = {
  // Connect to WebSocket server
  connectToSocket: (userId: string): Socket => {
    if (socket && socket.connected) {
      return socket;
    }
    
    // In a real app, this would connect to your actual WebSocket server
    socket = io('http://localhost:3001', {
      query: { userId },
      autoConnect: true,
      reconnection: true,
    });
    
    socket.on('connect', () => {
      console.log('Connected to WebSocket server');
    });
    
    socket.on('disconnect', () => {
      console.log('Disconnected from WebSocket server');
    });
    
    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
    
    return socket;
  },
  
  disconnectFromSocket: () => {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
  },
  
  createPublicGame: async (userId: string, gameOptions?: any): Promise<Game> => {
    console.log(`GameService.createPublicGame called by user: ${userId} with options:`, gameOptions);
    
    const gameId = `game_${Date.now()}`;
    const gameType = gameOptions?.gameType || 'public';
    
    // Handle invitation if this is a private game with an invitee
    if (gameType === 'private' && gameOptions?.inviteeUsername) {
      const inviteeId = getUserIdByUsername(gameOptions.inviteeUsername);
      if (!inviteeId) {
        throw new UserNotFoundError(`Invited user '${gameOptions.inviteeUsername}' not found`);
      }
      
      const game: Game = {
        id: gameId,
        gameId: gameId, // For compatibility with test expectations
        players: [
          {
            id: userId,
            userId: userId,
            username: getUsernameById(userId),
            color: 'white',
          }
        ],
        status: 'pending_invite',
        type: gameType,
        createdBy: userId,
        createdAt: new Date(),
        turn: 'white',
        invitedUser: gameOptions.inviteeUsername,
      };
      
      games.set(gameId, game);
      
      // In a real app, we'd emit a socket event to notify the invitee
      if (socket) {
        socket.emit('user:invitedToGame', {
          gameId,
          invitingUserName: getUsernameById(userId),
        });
      }
      
      return game;
    }
    
    // Regular public or private game (without specific invitee)
    const game: Game = {
      id: gameId,
      gameId: gameId, // For compatibility with test expectations
      players: [
        {
          id: userId,
          userId: userId,
          username: getUsernameById(userId),
          color: 'white', // Creator gets white
        }
      ],
      status: 'created',
      type: gameType,
      createdBy: userId,
      createdAt: new Date(),
      turn: 'white',
    };
    
    games.set(gameId, game);
    
    // In a real app, we'd emit a socket event to update the lobby
    if (gameType === 'public' && socket) {
      socket.emit('lobby:gamesListUpdated', {
        games: Array.from(games.values())
          .filter(g => g.type === 'public' && g.status === 'created')
          .map(g => ({
            ...g,
            timeSinceCreation: formatTimeSince(g.createdAt),
          })),
      });
    }
    
    return game;
  },
  
  getPublicGames: async (): Promise<Game[]> => {
    console.log('GameService.getPublicGames called');
    
    // Return only public games that are in 'created' status (waiting for opponent)
    return Array.from(games.values())
      .filter(game => game.type === 'public' && game.status === 'created')
      .map(game => ({
        ...game,
        timeSinceCreation: formatTimeSince(game.createdAt),
      }));
  },
  
  joinPublicGame: async (gameId: string, userId: string): Promise<Game> => {
    console.log(`GameService.joinPublicGame called for game: ${gameId} by user: ${userId}`);
    
    const game = games.get(gameId);
    if (!game) {
      throw new Error('Game not found');
    }
    
    if (game.type !== 'public') {
      throw new Error('Cannot join a private game. Use acceptInvitation instead.');
    }
    
    if (game.status !== 'created') {
      throw new Error('Game is not open for joining');
    }
    
    if (game.players.length >= 2) {
      throw new Error('Game is full');
    }
    
    if (game.players.some(p => p.userId === userId)) {
      throw new Error('You are already in this game');
    }
    
    // Add the player to the game
    const chessGame = new Chess(); // Initialize a new chess game
    
    game.players.push({
      id: userId,
      userId: userId,
      username: getUsernameById(userId),
      color: 'black', // Joiner gets black
    });
    
    game.status = 'active';
    game.board = chessGame.fen();
    game.history = [];
    game.pgn = chessGame.pgn();
    
    // Update the game in our in-memory storage
    games.set(gameId, game);
    
    // In a real app, we'd emit a socket event to notify the game creator
    if (socket) {
      socket.emit('game:playerJoined', {
        gameId,
        userId,
        gameState: game,
      });
      
      // Also update the lobby since this game is no longer available
      socket.emit('lobby:gamesListUpdated', {
        games: Array.from(games.values())
          .filter(g => g.type === 'public' && g.status === 'created')
          .map(g => ({
            ...g,
            timeSinceCreation: formatTimeSince(g.createdAt),
          })),
      });
    }
    
    return game;
  },
  
  acceptInvitation: async (invitationId: string, userId: string, gameId: string): Promise<Game> => {
    console.log(`GameService.acceptInvitation called for invitation: ${invitationId}, game: ${gameId} by user: ${userId}`);
    
    const game = games.get(gameId);
    if (!game) {
      throw new Error('Game not found');
    }
    
    if (game.status !== 'pending_invite') {
      throw new Error('Game is not pending invitation');
    }
    
    // Check if this user was actually invited
    const username = getUsernameById(userId);
    if (game.invitedUser !== username) {
      throw new Error('You were not invited to this game');
    }
    
    // Add the player to the game
    const chessGame = new Chess(); // Initialize a new chess game
    
    game.players.push({
      id: userId,
      userId: userId,
      username,
      color: 'black', // Invited player gets black
    });
    
    game.status = 'active';
    game.board = chessGame.fen();
    game.history = [];
    game.pgn = chessGame.pgn();
    delete game.invitedUser; // Remove the invitation
    
    // Update the game in our in-memory storage
    games.set(gameId, game);
    
    // In a real app, we'd emit a socket event to notify the game creator
    if (socket) {
      socket.emit('game:invitationAccepted', {
        invitationId,
        gameId,
        userId,
        gameState: game,
      });
    }
    
    return game;
  },
  
  makeMove: async (gameId: string, userId: string, move: { from: string, to: string, promotion?: string }): Promise<Game> => {
    console.log(`GameService.makeMove called for game: ${gameId} by user: ${userId} with move:`, move);
    
    const game = games.get(gameId);
    if (!game) {
      throw new Error('Game not found');
    }
    
    if (game.status !== 'active') {
      throw new Error('Game is not active');
    }
    
    // Find the player
    const player = game.players.find(p => p.userId === userId);
    if (!player) {
      throw new Error('Player not found in this game');
    }
    
    // Check if it's this player's turn
    if (game.turn !== player.color) {
      throw new Error('Not your turn');
    }
    
    // Initialize chess.js with the current board state
    const chessGame = new Chess(game.board);
    
    // Attempt to make the move
    let moveResult;
    try {
      moveResult = chessGame.move({
        from: move.from as Square,
        to: move.to as Square,
        promotion: move.promotion as PieceSymbol,
      });
    } catch (error) {
      throw new Error('Invalid move');
    }
    
    if (!moveResult) {
      throw new Error('Invalid move');
    }
    
    // Update game state
    game.board = chessGame.fen();
    game.history = chessGame.history({ verbose: true });
    game.pgn = chessGame.pgn();
    game.turn = game.turn === 'white' ? 'black' : 'white'; // Switch turns
    
    // Check game end conditions
    if (chessGame.isCheckmate()) {
      game.status = 'checkmate';
      game.winner = player.userId; // Current player wins by checkmate
    } else if (chessGame.isDraw()) {
      game.status = 'draw';
    } else if (chessGame.isStalemate()) {
      game.status = 'stalemate';
    }
    
    // Update the game in our in-memory storage
    games.set(gameId, game);
    
    // In a real app, we'd emit a socket event to update both players
    if (socket) {
      socket.emit('game:updated', {
        gameId,
        gameState: game,
        lastMove: moveResult,
        currentPlayer: game.turn,
      });
    }
    
    return game;
  },
  
  offerDraw: async (gameId: string, userId: string): Promise<Game> => {
    console.log(`GameService.offerDraw called for game: ${gameId} by user: ${userId}`);
    
    const game = games.get(gameId);
    if (!game) {
      throw new Error('Game not found');
    }
    
    if (game.status !== 'active') {
      throw new Error('Game is not active');
    }
    
    // Check if player is in the game
    if (!game.players.some(p => p.userId === userId)) {
      throw new Error('Player not found in this game');
    }
    
    // Mark that this player offered a draw
    game.drawOfferedBy = userId;
    
    // Update the game in our in-memory storage
    games.set(gameId, game);
    
    // In a real app, we'd emit a socket event to notify the opponent
    if (socket) {
      socket.emit('game:drawOffered', {
        gameId,
        offeringUserId: userId,
      });
    }
    
    return game;
  },
  
  respondToDraw: async (gameId: string, userId: string, accepted: boolean): Promise<Game> => {
    console.log(`GameService.respondToDraw called for game: ${gameId} by user: ${userId}, accepted: ${accepted}`);
    
    const game = games.get(gameId);
    if (!game) {
      throw new Error('Game not found');
    }
    
    if (game.status !== 'active') {
      throw new Error('Game is not active');
    }
    
    // Check if there's an active draw offer
    if (!game.drawOfferedBy) {
      throw new Error('No active draw offer');
    }
    
    // Check if player is in the game
    if (!game.players.some(p => p.userId === userId)) {
      throw new Error('Player not found in this game');
    }
    
    // Check if this player is the one who should respond (not the offerer)
    if (game.drawOfferedBy === userId) {
      throw new Error('You cannot respond to your own draw offer');
    }
    
    if (accepted) {
      // End the game in a draw
      game.status = 'draw';
    }
    
    // Clear the draw offer regardless of response
    delete game.drawOfferedBy;
    
    // Update the game in our in-memory storage
    games.set(gameId, game);
    
    // In a real app, we'd emit a socket event to notify both players
    if (socket) {
      socket.emit('game:drawResponded', {
        gameId,
        respondingUserId: userId,
        accepted,
        gameState: game,
      });
    }
    
    return game;
  },
  
  resign: async (gameId: string, userId: string): Promise<Game> => {
    console.log(`GameService.resign called for game: ${gameId} by user: ${userId}`);
    
    const game = games.get(gameId);
    if (!game) {
      throw new Error('Game not found');
    }
    
    if (game.status !== 'active') {
      throw new Error('Game is not active');
    }
    
    // Find the resigning player
    const player = game.players.find(p => p.userId === userId);
    if (!player) {
      throw new Error('Player not found in this game');
    }
    
    // Find the opponent (winner)
    const opponent = game.players.find(p => p.userId !== userId);
    
    // Mark game as resigned with winner
    game.status = 'resigned';
    if (opponent) {
      game.winner = opponent.userId;
    }
    
    // Update the game in our in-memory storage
    games.set(gameId, game);
    
    // In a real app, we'd emit a socket event to notify both players
    if (socket) {
      socket.emit('game:ended', {
        gameId,
        reason: 'resign',
        winner: game.winner,
        gameState: game,
      });
    }
    
    return game;
  },
  
  getGameDetails: async (gameId: string): Promise<Game> => {
    console.log(`GameService.getGameDetails called for game: ${gameId}`);
    
    const game = games.get(gameId);
    if (!game) {
      throw new Error('Game not found');
    }
    
    return game;
  },
  
  // Additional methods for game history and other features
  getUserGameHistory: async (userId: string): Promise<Game[]> => {
    console.log(`GameService.getUserGameHistory called for user: ${userId}`);
    
    // Find all games this user has participated in that are completed
    return Array.from(games.values())
      .filter(game => 
        game.players.some(p => p.userId === userId) && 
        ['checkmate', 'stalemate', 'draw', 'resigned'].includes(game.status)
      )
      .map(game => ({
        ...game,
        timeSinceCreation: formatTimeSince(game.createdAt),
      }));
  },
};

export default GameService;