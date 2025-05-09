# Multiplayer Chess Application Optimization Report

## Overview

This report outlines the optimization plan for the multiplayer chess application, focusing on four key areas for production readiness:

1. Persistent Storage Implementation
2. WebSocket Server Improvements 
3. Performance Optimizations
4. Security Enhancements

The current implementation uses in-memory storage for game state and lacks several production-ready features. This document provides specific recommendations and code changes to address these issues.

## 1. Persistent Storage Implementation

### Current State

The application currently uses in-memory storage for all game data:

```typescript
// In gameService.ts
const games: Map<string, Game> = new Map();

// In server.js
const users = new Map();
const games = new Map();
```

Game state is lost if the server restarts, and there's no persistence for game history or user data.

### Recommended Changes

#### 1.1 Create a Database Adapter Interface

Create an abstraction layer that can work with different database backends:

```typescript
// src/database/DatabaseAdapter.ts
export interface DatabaseAdapter {
  // Game operations
  createGame(game: Game): Promise<Game>;
  getGame(gameId: string): Promise<Game | null>;
  updateGame(gameId: string, gameData: Partial<Game>): Promise<Game>;
  listGames(filter: any): Promise<Game[]>;
  
  // User operations
  storeUserConnection(userId: string, socketId: string): Promise<void>;
  getUserConnection(userId: string): Promise<string | null>;
  removeUserConnection(userId: string): Promise<void>;
  
  // Game history
  getUserGameHistory(userId: string): Promise<Game[]>;
}
#### 1.2 Implement PostgreSQL Adapter

```typescript
// src/database/PostgresAdapter.ts
import { Pool } from 'pg';
import { DatabaseAdapter } from './DatabaseAdapter';
import { Game, Player, GameStatus } from '../services/gameService';

export class PostgresAdapter implements DatabaseAdapter {
  private pool: Pool;
  
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    // Initialize database tables if they don't exist
    this.initDatabase();
  }
  
  private async initDatabase() {
    // Create necessary tables if they don't exist
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS games (
        id VARCHAR(255) PRIMARY KEY,
        status VARCHAR(50) NOT NULL,
        type VARCHAR(50) NOT NULL,
        created_by VARCHAR(255) NOT NULL,
        created_at TIMESTAMP NOT NULL,
        turn VARCHAR(10) NOT NULL,
        board TEXT,
        pgn TEXT,
        winner VARCHAR(255),
        draw_offered_by VARCHAR(255),
        invited_user VARCHAR(255)
      )
    `);
    
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS players (
        id SERIAL PRIMARY KEY,
        game_id VARCHAR(255) REFERENCES games(id),
        user_id VARCHAR(255) NOT NULL,
        username VARCHAR(255) NOT NULL,
        color VARCHAR(10) NOT NULL
      )
    `);
    
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS moves (
        id SERIAL PRIMARY KEY,
        game_id VARCHAR(255) REFERENCES games(id),
        move_data JSONB NOT NULL,
        move_number INT NOT NULL,
        created_at TIMESTAMP NOT NULL
      )
    `);
    
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS user_connections (
        user_id VARCHAR(255) PRIMARY KEY,
        socket_id VARCHAR(255) NOT NULL,
        last_connected TIMESTAMP NOT NULL
      )
    `);
  }
  
  // Implementation of essential methods
  async createGame(game: Game): Promise<Game> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Insert game
      await client.query(`
        INSERT INTO games (
          id, status, type, created_by, created_at, turn, 
          board, pgn, winner, draw_offered_by, invited_user
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        game.id, 
        game.status, 
        game.type, 
        game.createdBy, 
        game.createdAt, 
        game.turn,
        game.board || null,
        game.pgn || null,
        game.winner || null,
        game.drawOfferedBy || null,
        game.invitedUser || null
      ]);
      
      // Insert players
      for (const player of game.players) {
        await client.query(`
          INSERT INTO players (game_id, user_id, username, color)
          VALUES ($1, $2, $3, $4)
        `, [game.id, player.userId, player.username, player.color]);
      }
      
      await client.query('COMMIT');
      return game;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  
  async getGame(gameId: string): Promise<Game | null> {
    const gameResult = await this.pool.query(`
      SELECT * FROM games WHERE id = $1
    `, [gameId]);
    
    if (gameResult.rows.length === 0) {
      return null;
    }
    
    const gameData = gameResult.rows[0];
    
    // Get players
    const playersResult = await this.pool.query(`
      SELECT * FROM players WHERE game_id = $1
    `, [gameId]);
    
    // Get moves (for history)
    const movesResult = await this.pool.query(`
      SELECT * FROM moves WHERE game_id = $1 ORDER BY move_number ASC
    `, [gameId]);
    
    const players: Player[] = playersResult.rows.map(row => ({
      id: row.user_id,
      userId: row.user_id,
      username: row.username,
      color: row.color as 'white' | 'black'
    }));
    
    const history = movesResult.rows.map(row => row.move_data);
    
    return {
      id: gameData.id,
      status: gameData.status as GameStatus,
      type: gameData.type as 'public' | 'private',
      createdBy: gameData.created_by,
      createdAt: new Date(gameData.created_at),
      turn: gameData.turn as 'white' | 'black',
      board: gameData.board,
      pgn: gameData.pgn,
      winner: gameData.winner,
      drawOfferedBy: gameData.draw_offered_by,
      invitedUser: gameData.invited_user,
      players,
      history
    };
  }
  
  // Additional methods omitted for brevity...
  // Full implementation would include all methods from the DatabaseAdapter interface
}
```
#### 1.3 Create In-Memory Adapter for Development/Testing

```typescript
// src/database/InMemoryAdapter.ts
import { DatabaseAdapter } from './DatabaseAdapter';
import { Game, Player, GameStatus } from '../services/gameService';

export class InMemoryAdapter implements DatabaseAdapter {
  private games: Map<string, Game> = new Map();
  private connections: Map<string, string> = new Map(); // userId -> socketId
  
  async createGame(game: Game): Promise<Game> {
    this.games.set(game.id, {...game});
    return game;
  }
  
  async getGame(gameId: string): Promise<Game | null> {
    const game = this.games.get(gameId);
    return game ? {...game} : null;
  }
  
  async updateGame(gameId: string, gameData: Partial<Game>): Promise<Game> {
    const game = this.games.get(gameId);
    if (!game) {
      throw new Error(`Game not found: ${gameId}`);
    }
    
    const updatedGame = {...game, ...gameData};
    this.games.set(gameId, updatedGame);
    return {...updatedGame};
  }
  
  async listGames(filter: any): Promise<Game[]> {
    let games = Array.from(this.games.values());
    
    // Apply filters
    if (filter.type) {
      games = games.filter(game => game.type === filter.type);
    }
    
    if (filter.status) {
      games = games.filter(game => game.status === filter.status);
    }
    
    if (filter.createdBy) {
      games = games.filter(game => game.createdBy === filter.createdBy);
    }
    
    // Sort by created_at desc
    games.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    // Apply pagination
    if (filter.limit) {
      const offset = filter.offset || 0;
      games = games.slice(offset, offset + filter.limit);
    }
    
    return games.map(game => ({...game}));
  }
  
  async storeUserConnection(userId: string, socketId: string): Promise<void> {
    this.connections.set(userId, socketId);
  }
  
  async getUserConnection(userId: string): Promise<string | null> {
    return this.connections.get(userId) || null;
  }
  
  async removeUserConnection(userId: string): Promise<void> {
    this.connections.delete(userId);
  }
  
  async getUserGameHistory(userId: string): Promise<Game[]> {
    const games = Array.from(this.games.values())
      .filter(game => 
        game.players.some(p => p.userId === userId) && 
        ['checkmate', 'stalemate', 'draw', 'resigned'].includes(game.status)
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    return games.map(game => ({...game}));
  }
}
```

#### 1.4 Create Database Factory

```typescript
// src/database/databaseFactory.ts
import { DatabaseAdapter } from './DatabaseAdapter';
import { PostgresAdapter } from './PostgresAdapter';
import { InMemoryAdapter } from './InMemoryAdapter';

export const createDatabaseAdapter = (): DatabaseAdapter => {
  // Use environment variable to determine which adapter to use
  const dbType = process.env.DATABASE_TYPE || 'memory';
  
  switch (dbType) {
    case 'postgres':
      return new PostgresAdapter();
    case 'memory':
    default:
      return new InMemoryAdapter();
  }
};

// Create a singleton instance
export const db = createDatabaseAdapter();
#### 1.5 Update GameService to Use Database Adapter

```typescript
// src/services/gameService.ts (modified version)
import { io, Socket } from 'socket.io-client';
import { Chess, Move, PieceSymbol, Square } from 'chess.js';
import { db } from '../database/databaseFactory';

// Game interface definitions remain the same...

// Remove these in-memory stores
// const games: Map<string, Game> = new Map();
let socket: Socket | null = null;

// Rest of the class implementation should be updated to use the database adapter
export const GameService = {
  // Connect to WebSocket server
  connectToSocket: (userId: string): Socket => {
    // Same implementation...
    return socket;
  },
  
  disconnectFromSocket: () => {
    // Same implementation...
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
      
      // Use database adapter instead of in-memory storage
      await db.createGame(game);
      
      // Same socket emission logic...
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
    
    // Use database adapter instead of in-memory storage
    await db.createGame(game);
    
    // Same socket emission logic...
    if (gameType === 'public' && socket) {
      // Get updated list of public games
      const publicGames = await db.listGames({
        type: 'public',
        status: 'created',
        limit: 20,
        offset: 0
      });
      
      socket.emit('lobby:gamesListUpdated', {
        games: publicGames.map(g => ({
          ...g,
          timeSinceCreation: formatTimeSince(g.createdAt),
        })),
      });
    }
    
    return game;
  },
  
  getPublicGames: async (): Promise<Game[]> => {
    console.log('GameService.getPublicGames called');
    
    // Use database adapter with pagination
    const games = await db.listGames({ 
      type: 'public', 
      status: 'created',
      limit: 20,
      offset: 0
    });
    
    // Return formatted games
    return games.map(game => ({
      ...game,
      timeSinceCreation: formatTimeSince(game.createdAt),
    }));
  },
  
  joinPublicGame: async (gameId: string, userId: string): Promise<Game> => {
    console.log(`GameService.joinPublicGame called for game: ${gameId} by user: ${userId}`);
    
    // Use database adapter to get the game
    const game = await db.getGame(gameId);
    if (!game) {
      throw new Error('Game not found');
    }
    
    // Same validation logic...
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
    const chessGame = new Chess();
    
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
    
    // Update the game using the database adapter
    await db.updateGame(gameId, {
      players: game.players,
      status: game.status,
      board: game.board,
      history: game.history,
      pgn: game.pgn
    });
    
    // Same socket emission logic...
    if (socket) {
      socket.emit('game:playerJoined', {
        gameId,
        userId,
        gameState: game,
      });
      
      // Get updated list of public games
      const publicGames = await db.listGames({
        type: 'public',
        status: 'created',
        limit: 20,
        offset: 0
      });
      
      socket.emit('lobby:gamesListUpdated', {
        games: publicGames.map(g => ({
          ...g,
          timeSinceCreation: formatTimeSince(g.createdAt),
        })),
      });
    }
    
    return game;
  },
  
  // Similar updates for all other methods...
  // Full implementation would update all methods to use the database adapter
};
```

## 2. WebSocket Server Improvements

### Current State

The current WebSocket server has basic functionality, but lacks production-ready features such as:
- It has permissive CORS settings (allowing all origins)
- Error handling is minimal
- It doesn't properly support reconnection
- No token verification for WebSocket authentication

### Recommended Changes

#### 2.1 Update CORS Settings

```javascript
// src/server.js (modified CORS settings)
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? (process.env.CORS_ORIGIN || 'https://yourdomain.com')
      : '*',
    methods: ['GET', 'POST'],
    credentials: true
  }
});
```
#### 2.2 Implement Proper Error Handling

```javascript
// src/server.js (improved error handling)
io.on('connection', async (socket) => {
  // ... existing connection logic
  
  // Global error handler for this socket
  socket.on('error', (error) => {
    console.error(`Socket error for ${socket.id}:`, error);
    socket.emit('error:general', {
      message: 'An unexpected error occurred',
      details: process.env.NODE_ENV === 'production' ? undefined : error.message
    });
  });
  
  // Add try/catch blocks to all event handlers
  socket.on('game:created', async (data) => {
    try {
      console.log('Game created:', data.gameId);
      
      // ... existing logic
      
    } catch (error) {
      console.error(`Error in game:created for ${socket.id}:`, error);
      socket.emit('error:general', {
        message: 'Failed to process game creation',
        details: process.env.NODE_ENV === 'production' ? undefined : error.message
      });
    }
  });
  
  // Similar updates to all other event handlers...
});

// Handle server-wide errors
io.engine.on('connection_error', (err) => {
  console.error('Connection error:', err);
});
```

#### 2.3 Add Reconnection Support

```javascript
// src/server.js (reconnection support)
io.on('connection', async (socket) => {
  console.log('Client connected:', socket.id);
  
  // Get userId from connection query parameters
  const userId = socket.handshake.query.userId;
  if (userId) {
    await db.storeUserConnection(userId, socket.id);
    console.log(`User ${userId} connected with socket ${socket.id}`);
    
    // Join user to their own room for targeted messages
    socket.join(`user:${userId}`);
    
    // Check if user has any active games and rejoin those rooms
    try {
      const activeGames = await db.listGames({
        status: 'active',
        player: userId
      });
      
      // Join socket to game rooms
      for (const game of activeGames) {
        console.log(`Rejoining user ${userId} to game ${game.id}`);
        socket.join(`game:${game.id}`);
        
        // Notify others in the game that this player has reconnected
        socket.to(`game:${game.id}`).emit('game:playerReconnected', {
          gameId: game.id,
          userId: userId
        });
        
        // Send the current game state back to the reconnected user
        socket.emit('game:stateSync', {
          gameId: game.id,
          gameState: game
        });
      }
    } catch (error) {
      console.error(`Error handling reconnection for user ${userId}:`, error);
    }
  }
  
  // ... rest of connection handler
});
```

#### 2.4 Implement Token Verification for WebSocket Authentication

```javascript
// src/server.js (token verification)
const { Server } = require('socket.io');
const http = require('http');
const jwt = require('jsonwebtoken');
const { db } = require('./database/databaseFactory');

// Create HTTP server
const server = http.createServer();

// Create Socket.IO server with CORS for production
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? process.env.CORS_ORIGIN || 'https://yourdomain.com' 
      : '*',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Add authentication middleware
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    
    if (!token) {
      return next(new Error('Authentication error: Token required'));
    }
    
    // Verify JWT token with Clerk's public key
    // In a real implementation, you would use the Clerk SDK to verify the token
    // or use the JWT_VERIFICATION_KEY from environment variables
    const decoded = jwt.verify(token, process.env.JWT_VERIFICATION_KEY);
    
    if (!decoded || !decoded.sub) {
      return next(new Error('Authentication error: Invalid token'));
    }
    
    // Store the authenticated user ID on the socket
    socket.userId = decoded.sub;
    next();
    
  } catch (error) {
    console.error('Socket authentication error:', error.message);
    next(new Error('Authentication error: ' + error.message));
  }
});

// Connection handler now has authenticated userId available
io.on('connection', async (socket) => {
  console.log('Authenticated client connected:', socket.id, socket.userId);
  
  // Use socket.userId from the authenticated token instead of query parameter
  const userId = socket.userId;
  
  // Rest of connection handler logic remains similar
  // ...
});
```

## 3. Performance Optimizations

### Current State

The application's performance could be improved in several areas:
- WebSocket message payloads send unnecessary data
- No caching mechanism for frequently accessed data
- Game lobby loads all games at once without pagination
- No optimization for reconnection or reconnection fallbacks

### Recommended Changes

#### 3.1 Optimize WebSocket Message Payloads

```typescript
// src/services/gameService.ts (optimized payloads)

// Helper to create minimal game data for lobby
const createLobbyGameData = (game: Game) => ({
  id: game.id,
  createdBy: game.createdBy,
  createdAt: game.createdAt,
  timeSinceCreation: formatTimeSince(game.createdAt),
  playerCount: game.players.length,
  creatorName: game.players[0]?.username || 'Unknown'
});

// Helper to create minimal game state for updates
const createGameStateUpdate = (game: Game) => ({
  id: game.id,
  status: game.status,
  turn: game.turn,
  board: game.board,
  lastMove: game.history ? game.history[game.history.length - 1] : null,
  players: game.players.map(p => ({
    userId: p.userId,
    username: p.username,
    color: p.color
  }))
});

// Update getPublicGames to use optimized data structure
getPublicGames: async (): Promise<any[]> => {
  console.log('GameService.getPublicGames called');
  
  // Use database adapter with pagination
  const games = await db.listGames({ 
    type: 'public', 
    status: 'created',
    limit: 20,
    offset: 0
  });
  
  // Return only the data needed for the lobby
  return games.map(createLobbyGameData);
},

// Update socket emissions to use optimized payloads
// For example, in the makeMove method:
if (socket) {
  socket.emit('game:updated', {
    gameId: game.id,
    gameState: createGameStateUpdate(game),
    currentPlayer: game.turn
  });
}
```

#### 3.2 Add Caching for Frequently Accessed Data
// src/cache/gameCache.ts
import NodeCache from 'node-cache';
import { Game } from '../services/gameService';

// Create cache with TTL of 5 minutes by default
const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

export const GameCache = {
  // Cache keys
  LOBBY_GAMES: 'lobby:games',
  GAME_DETAILS: (gameId: string) => `game:${gameId}`,
  USER_HISTORY: (userId: string) => `user:${userId}:history`,
  
  // Store public games list in cache
  storePublicGames: (games: any[]): void => {
    cache.set(GameCache.LOBBY_GAMES, games);
  },
  
  // Get public games from cache
  getPublicGames: (): any[] | undefined => {
    return cache.get<any[]>(GameCache.LOBBY_GAMES);
  },
  
  // Store game details in cache
  storeGameDetails: (gameId: string, game: Game): void => {
    cache.set(GameCache.GAME_DETAILS(gameId), game);
  },
  
  // Get game details from cache
  getGameDetails: (gameId: string): Game | undefined => {
    return cache.get<Game>(GameCache.GAME_DETAILS(gameId));
  },
  
  // Store user game history in cache
  storeUserHistory: (userId: string, games: Game[]): void => {
    cache.set(GameCache.USER_HISTORY(userId), games);
  },
  
  // Get user game history from cache
  getUserHistory: (userId: string): Game[] | undefined => {
    return cache.get<Game[]>(GameCache.USER_HISTORY(userId));
  },
  
  // Invalidate cache for a game (when it's updated)
  invalidateGame: (gameId: string): void => {
    cache.del(GameCache.GAME_DETAILS(gameId));
    cache.del(GameCache.LOBBY_GAMES); // Also invalidate lobby since game status changed
  },
  
  // Invalidate all games (e.g., on server restart)
  invalidateAllGames: (): void => {
    cache.flushAll();
  }
};
```

Update the GameService to use the cache:

```typescript
// src/services/gameService.ts (with caching)
import { GameCache } from '../cache/gameCache';

// ...existing imports

export const GameService = {
  // ...existing methods
  
  getPublicGames: async (): Promise<any[]> => {
    console.log('GameService.getPublicGames called');
    
    // Check cache first
    const cachedGames = GameCache.getPublicGames();
    if (cachedGames) {
      console.log('Returning cached lobby games');
      return cachedGames;
    }
    
    // Cache miss - query database
    const games = await db.listGames({ 
      type: 'public', 
      status: 'created',
      limit: 20,
      offset: 0
    });
    
    // Format and cache results
    const formattedGames = games.map(createLobbyGameData);
    GameCache.storePublicGames(formattedGames);
    
    return formattedGames;
  },
  
  getGameDetails: async (gameId: string): Promise<Game> => {
    console.log(`GameService.getGameDetails called for game: ${gameId}`);
    
    // Check cache first
    const cachedGame = GameCache.getGameDetails(gameId);
    if (cachedGame) {
      console.log(`Returning cached game: ${gameId}`);
      return cachedGame;
    }
    
    // Cache miss - query database
    const game = await db.getGame(gameId);
    if (!game) {
      throw new Error('Game not found');
    }
    
    // Cache the result
    GameCache.storeGameDetails(gameId, game);
    
    return game;
  },
  
  // Other methods need to invalidate cache when they update a game
  makeMove: async (gameId: string, userId: string, move: { from: string, to: string, promotion?: string }): Promise<Game> => {
    // ...existing implementation
    
    // After updating the game
    await db.updateGame(gameId, {
      // ...existing update data
    });
    
    // Invalidate the cache for this game
    GameCache.invalidateGame(gameId);
    
    // ...rest of the method
    return game;
  },
  
  // Similarly update other methods that modify game state
};
```

#### 3.3 Implement Pagination for Game Listings

```typescript
// src/app/api/multiplayer/games/route.ts (with pagination)
import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { GameService } from '../../../../services/gameService';

export async function GET(request: NextRequest) {
  try {
    const { userId } = getAuth(request);
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get pagination parameters from query
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    
    // Calculate offset
    const offset = (page - 1) * limit;
    
    // Get games with pagination
    const games = await GameService.getPublicGamesWithPagination(limit, offset);
    
    // Get total count for pagination metadata
    const totalCount = await GameService.getPublicGamesCount();
    
    return NextResponse.json({
      games,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
        totalCount
      }
    });
    
  } catch (error) {
    console.error('Error fetching games:', error);
    return NextResponse.json(
      { error: (error as Error).message || 'Failed to fetch games' },
      { status: 500 }
    );
  }
}
```

Add the pagination methods to GameService:

```typescript
// Add to src/services/gameService.ts
getPublicGamesWithPagination: async (limit: number, offset: number): Promise<any[]> => {
  console.log(`GameService.getPublicGamesWithPagination called with limit: ${limit}, offset: ${offset}`);
  
  // Use database adapter with pagination
  const games = await db.listGames({ 
    type: 'public', 
    status: 'created',
    limit,
    offset
  });
  
  // Return only the data needed for the lobby
  return games.map(createLobbyGameData);
},

getPublicGamesCount: async (): Promise<number> => {
  console.log('GameService.getPublicGamesCount called');
  
  // Add a count method to the DatabaseAdapter interface and implementations
  return db.countGames({ type: 'public', status: 'created' });
}
```

Update the client-side lobby component to use pagination:

```tsx
// src/app/multiplayer/page.tsx (with pagination)
'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import Link from 'next/link';

export default function MultiplayerLobby() {
  const { user, isSignedIn, isLoaded } = useUser();
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Pagination state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      fetchGames();
    }
  }, [isLoaded, isSignedIn, page, limit]);
  
  const fetchGames = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/multiplayer/games?page=${page}&limit=${limit}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch games');
      }
      
      const data = await response.json();
      setGames(data.games);
      setTotalPages(data.pagination.totalPages);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handlePrevPage = () => {
    if (page > 1) setPage(page - 1);
  };
  
  const handleNextPage = () => {
    if (page < totalPages) setPage(page + 1);
  };
  
  // Render component with pagination controls
  // ...
}
```

## 4. Security Enhancements

### Current State

The application currently has several security vulnerabilities:
- WebSocket connections don't verify authentication tokens
- No rate limiting for game actions
- CORS is configured to allow all origins in development and production
- No input validation on WebSocket events

### Recommended Changes

#### 4.1 Improve WebSocket Authentication with Token Verification

This was already covered in section 2.4 above. By verifying JWT tokens from Clerk, we ensure that only authenticated users can establish WebSocket connections.

#### 4.2 Add Rate Limiting for Game Actions

```javascript
// src/server.js (with rate limiting)
const { Server } = require('socket.io');
const http = require('http');
const jwt = require('jsonwebtoken');
const { db } = require('./database/databaseFactory');
const { RateLimiterMemory } = require('rate-limiter-flexible');

// Create rate limiters for different actions
const moveLimiter = new RateLimiterMemory({
  points: 10,           // 10 moves
  duration: 60,         // per 1 minute
});

const gameLimiter = new RateLimiterMemory({
  points: 5,            // 5 games
  duration: 60 * 5,     // per 5 minutes
});

const drawOfferLimiter = new RateLimiterMemory({
  points: 3,            // 3 draw offers
  duration: 60,         // per 1 minute
});

// Apply rate limiting to socket events
io.on('connection', async (socket) => {
  // ...authentication and connection logic
  
  // Rate-limited move handler
  socket.on('game:updated', async (data) => {
    try {
      // Check rate limit
      await moveLimiter.consume(socket.userId);
      
      // Process the move
      // ...existing logic
      
    } catch (error) {
      if (error.consumedPoints) {
        // This is a rate limit error
        socket.emit('error:rateLimit', {
          message: 'Rate limit exceeded for moves. Please wait before making more moves.',
          retryAfter: error.msBeforeNext / 1000
        });
      } else {
        // Other error
        socket.emit('error:general', {
          message: 'Failed to process move',
          details: process.env.NODE_ENV === 'production' ? undefined : error.message
        });
      }
    }
  });
  
  // Rate-limited game creation handler
  socket.on('game:created', async (data) => {
    try {
      // Check rate limit
      await gameLimiter.consume(socket.userId);
      
      // Process game creation
      // ...existing logic
      
    } catch (error) {
      if (error.consumedPoints) {
        // This is a rate limit error
        socket.emit('error:rateLimit', {
          message: 'Rate limit exceeded for game creation. Please wait before creating more games.',
          retryAfter: error.msBeforeNext / 1000
        });
      } else {
        // Other error
        socket.emit('error:general', {
          message: 'Failed to create game',
          details: process.env.NODE_ENV === 'production' ? undefined : error.message
        });
      }
    }
  });
  
  // Similarly apply rate limiting to other events
});
```

#### 4.3 Implement Proper CORS Restrictions

```javascript
// src/server.js (strict CORS policy)
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' 
      ? [process.env.CORS_ORIGIN].filter(Boolean) // Only specific origins in production
      : '*', // Any origin in development
    methods: ['GET', 'POST'],
    credentials: true,
    allowedHeaders: ['Authorization', 'Content-Type']
  }
});
```

#### 4.4 Add Input Validation for WebSocket Events

```javascript
// src/utils/validateInput.js
const Joi = require('joi');

// Validation schemas
const schemas = {
  gameCreation: Joi.object({
    gameType: Joi.string().valid('public', 'private').required(),
    inviteeUsername: Joi.string().when('gameType', {
      is: 'private',
      then: Joi.required(),
      otherwise: Joi.forbidden()
    })
  }),
  
  gameMove: Joi.object({
    gameId: Joi.string().required(),
    from: Joi.string().pattern(/^[a-h][1-8]$/).required(),
    to: Joi.string().pattern(/^[a-h][1-8]$/).required(),
    promotion: Joi.string().valid('q', 'r', 'n', 'b').optional()
  }),
  
  drawOffer: Joi.object({
    gameId: Joi.string().required()
  }),
  
  drawResponse: Joi.object({
    gameId: Joi.string().required(),
    accepted: Joi.boolean().required()
  }),
  
  resignation: Joi.object({
    gameId: Joi.string().required()
  })
};

// Validate input against schema
module.exports.validate = (schema, data) => {
  const validationSchema = schemas[schema];
  if (!validationSchema) {
    throw new Error(`Validation schema '${schema}' not found`);
  }
  
  const { error, value } = validationSchema.validate(data);
  if (error) {
    throw new Error(`Validation error: ${error.message}`);
  }
  
  return value;
};
```

Apply validation in the WebSocket server:

```javascript
// src/server.js (with input validation)
const { validate } = require('./utils/validateInput');

io.on('connection', async (socket) => {
  // ...existing connection logic
  
  // Validate game creation
  socket.on('game:created', async (data) => {
    try {
      // Validate input
      const validatedData = validate('gameCreation', data);
      
      // Process with validated data
      // ...existing logic
      
    } catch (error) {
      if (error.message.startsWith('Validation error:')) {
        socket.emit('error:validation', {
          message: error.message
        });
      } else {
        socket.emit('error:general', {
          message: 'Failed to create game',
          details: process.env.NODE_ENV === 'production' ? undefined : error.message
        });
      }
    }
  });
  
  // Validate game moves
  socket.on('game:updated', async (data) => {
    try {
      // Validate input
      const validatedData = validate('gameMove', data);
      
      // Process with validated data
      // ...existing logic
      
    } catch (error) {
      if (error.message.startsWith('Validation error:')) {
        socket.emit('error:validation', {
          message: error.message
        });
      } else {
        socket.emit('error:general', {
          message: 'Failed to process move',
          details: process.env.NODE_ENV === 'production' ? undefined : error.message
        });
      }
    }
  });
  
  // Similarly validate other events
});
```

## Summary and Implementation Plan

The multiplayer chess application requires several improvements to be production-ready. These improvements have been organized into four key areas:

1. **Persistent Storage Implementation**
   - Created a database adapter interface to abstract database operations
   - Implemented PostgreSQL adapter for production use
   - Provided in-memory adapter for development/testing
   - Updated GameService to use the database adapter instead of in-memory maps

2. **WebSocket Server Improvements**
   - Updated CORS settings to be environment-appropriate
   - Added comprehensive error handling to WebSocket events
   - Implemented reconnection support for clients
   - Added token verification for secure WebSocket authentication

3. **Performance Optimizations**
   - Optimized WebSocket message payloads to reduce data transfer
   - Added caching for frequently accessed data to reduce database load
   - Implemented pagination for game listings to improve lobby performance

4. **Security Enhancements**
   - Improved authentication with token verification
   - Added rate limiting for game actions to prevent abuse
   - Implemented proper CORS restrictions for production
   - Added input validation for all WebSocket events

### Implementation Priority

To implement these changes in a structured manner, the following priority order is recommended:

1. First: Persistent storage implementation, as this is foundational for other improvements
2. Second: Security enhancements, to ensure the application is secure before deploying
3. Third: WebSocket server improvements, to ensure reliable communication
4. Fourth: Performance optimizations, to improve the user experience

### Dependencies to Add

The following packages should be added to the project:

```
npm install pg node-cache rate-limiter-flexible joi jsonwebtoken
npm install --save-dev @types/pg @types/node-cache @types/jsonwebtoken
```

### Configuration

Environment variables needed for the implementation:

```
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/chess_db
DATABASE_TYPE=postgres  # or "memory" for development/testing

# Security
JWT_VERIFICATION_KEY=your_clerk_jwt_verification_key
CORS_ORIGIN=https://your-production-domain.com

# Environment
NODE_ENV=production  # or "development"
```

By implementing these changes, the multiplayer chess application will be production-ready with improved security, reliability, and performance.
```