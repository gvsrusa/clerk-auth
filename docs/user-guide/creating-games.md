# Creating Games

This guide explains how to create multiplayer chess games in the application, including both public games that anyone can join and private games by invitation.

## Accessing the Game Creation Interface

To create a new game:

1. Log in to your account
2. Navigate to the multiplayer section by clicking "Multiplayer" in the main navigation
3. In the multiplayer lobby, click the "Create New Game" button
4. The game creation interface will appear

## Creating a Public Game

Public games are visible to all users and can be joined by anyone:

1. In the game creation interface, select "Public Game" as the game type
2. Configure game settings (if available):
   - Time control (if implemented)
   - Starting position (standard or from a specific FEN)
3. Click "Create Game"
4. Your game will be created, and you'll be assigned the white pieces
5. Your game will appear in the "Available Games" list in the lobby for others to join
6. Wait for an opponent to join your game

### Public Game Considerations

- Public games are visible to all users in the application
- The first player to click "Join" will become your opponent
- You cannot restrict who can join a public game
- If you leave the browser while waiting, your game will remain available for others to join
- Public games may expire if not joined within a certain timeframe (24 hours by default)

## Creating a Private Game

Private games are invitation-only and not visible to other users:

1. In the game creation interface, select "Private Game" as the game type
2. Enter the username of the player you want to invite
3. Configure game settings (if available):
   - Time control (if implemented)
   - Starting position (standard or from a specific FEN)
4. Click "Create Game"
5. The invited player will receive a notification about your invitation
6. You'll be assigned the white pieces
7. Wait for the invited player to accept your invitation

### Private Game Considerations

- Private games are only visible to you and the invited player
- The invited player must have an account in the application
- The invited player will receive a notification about your invitation
- Private game invitations expire after 24 hours if not accepted
- You can cancel a private game invitation before it's accepted

## Canceling a Game

If you create a game but want to cancel it before anyone joins:

1. Go to the multiplayer lobby
2. Find your game in the "Your Games" section
3. Click the "Cancel Game" button next to your game
4. Confirm that you want to cancel the game
5. The game will be removed from the lobby

For private games, canceling also removes the invitation from the invited player's notifications.

## Managing Game Invitations

To view and manage the games you've created:

1. Go to the multiplayer lobby
2. Look for the "Your Games" section
3. This section shows:
   - Games you've created that are waiting for players
   - Private game invitations you've sent
4. For each game, you can:
   - See when it was created
   - View the invited player's name (for private games)
   - Cancel the game or invitation

## Game Creation Limits

To ensure fair usage of the system, there are limits on game creation:

- You can have up to 5 active public games waiting for players
- You can have up to 10 active private game invitations at once
- There's a rate limit of 5 new games every 5 minutes

If you're unable to create a new game, you may have reached one of these limits. Wait for some of your existing games to be joined or canceled, or for some time to pass before trying again.

## Game Creation From Match History

You can also create a new game with a previous opponent:

1. Go to the "Game History" section
2. Find a completed game with the player you want to challenge again
3. Click "Rematch" button
4. This will create a private game invitation to the same player
5. The colors will be reversed from your previous game (if you played white, you'll now play black)

## Sharing Game Invitations

For private games, you can share a direct invitation link:

1. After creating a private game, look for the "Copy Invitation Link" button
2. Click the button to copy the link to your clipboard
3. Share this link with your intended opponent through external means (email, messaging, etc.)
4. When they click the link, they'll be directed to join your game (they'll need to log in first if not already logged in)

This is particularly useful if you want to invite someone who might not check their in-app notifications regularly.

## Customizing Game Settings

Depending on the implementation, you may have additional game settings options:

### Time Controls

If time controls are implemented, you may be able to select from options such as:
- Bullet (1 minute per player)
- Blitz (3-5 minutes per player)
- Rapid (10 minutes per player)
- Classical (30+ minutes per player)
- Custom time settings

### Alternative Starting Positions

If supported, you may be able to:
- Start from a specific position using FEN notation
- Choose from preset opening positions
- Continue from a position in a previous game

## Troubleshooting Game Creation

If you encounter issues when creating games:

### "Username Not Found" Error

When creating a private game, this means the username you entered doesn't exist. Double-check the spelling of the username and try again.

### "Too Many Active Games" Error

You've reached the limit of active games you can create. Either wait for some of your games to be joined or cancel some of your existing game creations.

### "Rate Limit Exceeded" Error

You've created too many games in a short period. Wait a few minutes before trying to create another game.

### "Unable to Create Game" Error

There might be a server issue or another technical problem. Try refreshing the page and creating the game again. If the problem persists, contact support.