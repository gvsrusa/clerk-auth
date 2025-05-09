// src/server.js - Simple WebSocket server for multiplayer chess
const { Server } = require('socket.io');
const http = require('http');

// Create HTTP server
const server = http.createServer();

// Create Socket.IO server with CORS for development
const io = new Server(server, {
  cors: {
    origin: '*', // In production, restrict to your domain
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Store active connections
const users = new Map();
const games = new Map();

// Socket.IO connection handler
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // Get userId from connection query parameters
  const userId = socket.handshake.query.userId;
  if (userId) {
    users.set(userId, socket.id);
    console.log(`User ${userId} connected with socket ${socket.id}`);
    
    // Join user to their own room for targeted messages
    socket.join(`user:${userId}`);
  }
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    
    // Remove from users map
    if (userId) {
      users.delete(userId);
      console.log(`User ${userId} disconnected`);
    }
  });
  
  // Game events
  
  // Game created
  socket.on('game:created', (data) => {
    console.log('Game created:', data.gameId);
    
    // Store game reference
    games.set(data.gameId, {
      ...data,
      players: data.players.map(p => p.userId)
    });
    
    // If it's a public game, broadcast to lobby
    if (!data.isPrivate) {
      io.emit('lobby:gamesListUpdated', {
        games: Array.from(games.values())
          .filter(g => !g.isPrivate && g.status === 'created')
      });
    }
    
    // If it's a private game with invitation, notify the invitee
    if (data.isPrivate && data.invitedUser) {
      const inviteeId = data.invitedUser;
      const inviteeSocketId = users.get(inviteeId);
      
      if (inviteeSocketId) {
        io.to(`user:${inviteeId}`).emit('user:invitedToGame', {
          gameId: data.gameId,
          invitingUserName: data.createdBy
        });
      }
    }
  });
  
  // Player joined game
  socket.on('game:playerJoined', (data) => {
    console.log('Player joined game:', data.gameId, data.userId);
    
    // Update game reference
    const game = games.get(data.gameId);
    if (game) {
      game.status = 'active';
      game.players.push(data.userId);
      games.set(data.gameId, game);
      
      // Notify all players in the game
      game.players.forEach(playerId => {
        io.to(`user:${playerId}`).emit('game:playerJoined', data);
      });
      
      // Update lobby by removing this game from available games
      io.emit('lobby:gamesListUpdated', {
        games: Array.from(games.values())
          .filter(g => !g.isPrivate && g.status === 'created')
      });
    }
  });
  
  // Game updated (move made)
  socket.on('game:updated', (data) => {
    console.log('Game updated:', data.gameId);
    
    // Get game reference
    const game = games.get(data.gameId);
    if (game) {
      // Update game state
      games.set(data.gameId, {
        ...game,
        ...data.gameState
      });
      
      // Notify all players in the game
      game.players.forEach(playerId => {
        io.to(`user:${playerId}`).emit('game:updated', data);
      });
    }
  });
  
  // Draw offered
  socket.on('game:drawOffered', (data) => {
    console.log('Draw offered:', data.gameId, data.offeringUserId);
    
    // Get game reference
    const game = games.get(data.gameId);
    if (game) {
      // Notify opponent
      const opponent = game.players.find(id => id !== data.offeringUserId);
      if (opponent) {
        io.to(`user:${opponent}`).emit('game:drawOffered', data);
      }
    }
  });
  
  // Draw responded
  socket.on('game:drawResponded', (data) => {
    console.log('Draw responded:', data.gameId, data.accepted);
    
    // Get game reference
    const game = games.get(data.gameId);
    if (game) {
      // If accepted, update game state
      if (data.accepted) {
        games.set(data.gameId, {
          ...game,
          status: 'draw'
        });
      }
      
      // Notify all players in the game
      game.players.forEach(playerId => {
        io.to(`user:${playerId}`).emit('game:drawResponded', data);
      });
    }
  });
  
  // Game ended
  socket.on('game:ended', (data) => {
    console.log('Game ended:', data.gameId, data.reason);
    
    // Get game reference
    const game = games.get(data.gameId);
    if (game) {
      // Update game state
      games.set(data.gameId, {
        ...game,
        status: data.reason === 'resign' ? 'resigned' : data.reason,
        winner: data.winner
      });
      
      // Notify all players in the game
      game.players.forEach(playerId => {
        io.to(`user:${playerId}`).emit('game:ended', data);
      });
    }
  });
  
  // Invitation declined
  socket.on('game:invitationDeclined', (data) => {
    console.log('Invitation declined:', data.gameId, data.userId);
    
    // Get game reference
    const game = games.get(data.gameId);
    if (game) {
      // Notify the game creator
      io.to(`user:${game.createdBy}`).emit('game:invitationDeclined', {
        gameId: data.gameId,
        declinedBy: data.userId
      });
      
      // Remove the game from our tracking
      games.delete(data.gameId);
    }
  });
});

// Start server
const PORT = process.env.SOCKET_PORT || 3001;
server.listen(PORT, () => {
  console.log(`Socket.IO server running on port ${PORT}`);
});