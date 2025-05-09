# Multiplayer Chess Feature

This document provides an overview of the multiplayer chess feature implementation.

## Features Implemented

1. **Game Creation**:
   - Create public games that anyone can join
   - Create private games by inviting specific users
   - Real-time game lobby updates

2. **Game Joining**:
   - Join available public games
   - Accept/decline game invitations
   - Handle full games and error conditions

3. **Game Play**:
   - Real-time move synchronization
   - Turn-based gameplay with visual indicators
   - Sound notifications when it's your turn
   - Move validation using chess.js

4. **Game Flow Controls**:
   - Offer and respond to draw offers
   - Resign from games
   - Game state tracking (checkmate, stalemate, etc.)

5. **Socket Connection**:
   - Real-time updates for both players
   - Lobby updates for available games
   - Game invitations and notifications

## Project Structure

- `src/services/gameService.ts` - Core game service with all multiplayer functionality
- `src/app/multiplayer/page.tsx` - Game lobby UI
- `src/app/multiplayer/game/[gameId]/page.tsx` - Game board UI
- `src/app/api/multiplayer/games/route.ts` - API endpoints for game operations
- `src/middleware.ts` - Authentication checks for protected routes
- `src/server.js` - WebSocket server for real-time updates

## Running the Application

1. **Start the Next.js application**:
   ```
   npm run dev
   ```

2. **Start the WebSocket server in a separate terminal**:
   ```
   node src/server.js
   ```

3. **Access the multiplayer lobby**:
   Navigate to `http://localhost:3000/multiplayer`

## How to Play

1. **Creating a Game**:
   - Sign in to your account
   - Go to the multiplayer lobby
   - Click "Create New Game"
   - Select game type (public or private)
   - For private games, optionally enter a username to invite

2. **Joining a Game**:
   - Browse available public games in the lobby
   - Click "Join Game" on any available game
   - Or accept an invitation if you've been invited to a private game

3. **Playing**:
   - White moves first
   - Click on a piece to see possible moves
   - Click on a highlighted square to make a move
   - The game board updates in real-time for both players
   - Wait for your turn when your opponent is moving

4. **Game Controls**:
   - Use "Offer Draw" to propose a draw to your opponent
   - Use "Resign" to forfeit the game
   - Game result is displayed when the game ends

## Testing

Tests are available in the `src/app/multiplayer` directory:
- `game-creation.test.ts`
- `joining-games.test.ts`
- `move-sync-turn-notification.test.ts`
- `game-lobby.test.ts`

Run tests with:
```
npm test
```

## Dependencies

- `chess.js` - For chess logic and move validation
- `socket.io-client` - For WebSocket connections
- `socket.io` (server) - For WebSocket server
- `clerk/nextjs` - For user authentication

## Future Enhancements

- Game history and replay functionality
- ELO rating system
- Tournament mode
- Spectator functionality
- In-game chat