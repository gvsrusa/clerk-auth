// src/services/gameService.ts

// This is a mock GameService. In a real application, this would interact with a database or other services.
export const GameService = {
  createPublicGame: async (userId: string, gameOptions?: any) => {
    // Simulate game creation
    console.log(`GameService.createPublicGame called by user: ${userId} with options:`, gameOptions);
    // The test expects creatorId and gameType, let's adjust the mock return if needed or the call in API
    return { gameId: `game_${Date.now()}`, status: 'created', createdBy: userId, type: gameOptions?.gameType || 'public' };
  },

  getPublicGames: async () => {
    // Simulate fetching public games
    console.log('GameService.getPublicGames called');
    // Return a mock list of games. In a real app, this would query a database.
    // For testing, we can return an empty array or a pre-defined list.
    // For now, let's return an empty array to allow for "empty lobby" tests.
    return [];
  },
  // Add other game-related methods here, e.g., createPrivateGame, joinGame, etc.
};

export default GameService;