# Game Play Instructions

This guide explains how to play chess in the multiplayer mode of the application, including making moves, understanding the game interface, and using the various game controls.

## Game Board Interface

When you enter a game, you'll see the following elements on the screen:

- **Chess Board**: The standard 8x8 chess board with pieces
- **Game Information**: Shows the usernames of both players, their colors, and the game status
- **Move History**: A list of moves that have been played so far
- **Game Controls**: Buttons for offering a draw, resigning, etc.
- **Turn Indicator**: Shows whose turn it is currently
- **Game Status**: Displays the current state of the game (active, check, checkmate, etc.)

## Making Moves

To make a move:

1. **Wait for your turn**: The turn indicator will show when it's your turn to move
2. **Select a piece**: Click on one of your pieces to select it
3. **See possible moves**: Valid destination squares will be highlighted
4. **Make your move**: Click on a highlighted square to move your piece there
5. **Special moves**:
   - **Castling**: Click on your king, then click on the destination square (two squares toward the rook)
   - **En Passant**: Click on your pawn, then click on the diagonal square behind an opponent's pawn that just moved two squares
   - **Promotion**: When your pawn reaches the opposite end of the board, a promotion dialog will appear allowing you to choose which piece to promote to (usually queen, rook, bishop, or knight)

## Understanding Turn Mechanics

- **Turn Order**: White always moves first, followed by black, alternating throughout the game
- **Turn Notifications**: 
  - Visual indicators on the board show whose turn it is
  - A sound notification plays when it's your turn (if you have sound enabled)
  - The turn indicator clearly displays "Your Turn" or "Opponent's Turn"
- **Time Considerations**: The current implementation doesn't include time controls, so there's no time limit for making moves

## Game Status Indicators

The game status indicator shows the current state of the game:

- **Active**: The game is in progress
- **Check**: One player's king is under attack
- **Checkmate**: One player's king is under attack and cannot escape, ending the game
- **Stalemate**: The player to move has no legal moves but is not in check, resulting in a draw
- **Draw by Agreement**: Both players have agreed to end the game as a draw
- **Resigned**: One player has conceded the game
- **Disconnected**: One player has disconnected from the game (temporary status)

## Chess Rules Enforcement

The application automatically enforces standard chess rules:

- Only legal moves are allowed
- Check must be addressed immediately
- Checkmate and stalemate are detected automatically
- Special moves (castling, en passant, promotion) are handled according to standard chess rules

## Reconnecting to Games

If you get disconnected during a game:

1. Simply navigate back to the multiplayer section
2. The game will appear in your "Active Games" list
3. Click on the game to rejoin
4. The board will be restored to its current state

## Game Chat and Communication

The current version does not include in-game chat functionality. Communication is limited to:

- Game actions (moves, draw offers, etc.)
- Game status indicators
- Pre-defined system messages

For communication with your opponent, you'll need to use external communication tools.