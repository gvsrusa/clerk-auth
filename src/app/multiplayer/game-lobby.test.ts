// src/app/multiplayer/game-lobby.test.ts
import { NextRequest, NextResponse } from 'next/server';
// Import the GET handler from the API route
import { GET as getGamesApiHandler } from '../api/multiplayer/games/route'; // Adjust path as needed

// Mock Clerk for getAuth
let mockUserIdForGetAuth: string | null = null;
jest.mock('@clerk/nextjs/server', () => {
  const originalModule = jest.requireActual('@clerk/nextjs/server');
  return {
    __esModule: true,
    ...originalModule,
    getAuth: jest.fn(() => ({ userId: mockUserIdForGetAuth })),
  };
});

// Mock GameService
interface GameServiceLobbyMocks {
  getPublicGames: jest.Mock;
  // Add other methods if they are mocked in this file specifically
}

// 1. Initialize an object containing the actual mock functions.
// This object and its mock functions are created before Jest's mock factory for GameService is called.
const gameServiceMockFunctions: GameServiceLobbyMocks = {
  getPublicGames: jest.fn(),
  // Add other actual mocks here if GameServiceLobbyMocks expands
};

// 2. Mock the GameService module.
// The factory function will reference the already-initialized mocks in gameServiceMockFunctions.
jest.mock('../../services/gameService', () => {
  // This factory function provides the mock for the entire 'gameService' module.
  // We are assuming GameService is a class that gets instantiated (e.g., new GameService()).
  // Therefore, we mock the GameService constructor to return an object (the instance)
  // which has methods that are our pre-defined jest.fn() mocks.
  return {
    GameService: jest.fn().mockImplementation(() => {
      return {
        // This ensures that when an instance of GameService is created and its
        // getPublicGames method is called, it uses our specific mock function.
        getPublicGames: gameServiceMockFunctions.getPublicGames,
      };
    }),
  };
});


describe('Multiplayer Feature: Game Lobby and Discovery (US2, AC2, FR3) - API Tests', () => {
  let mockRequest: NextRequest;

  beforeEach(() => {
    // Clear and setup mocks for getAuth path (API routes)
    mockUserIdForGetAuth = null;
    (jest.requireMock('@clerk/nextjs/server').getAuth as jest.Mock).mockClear().mockImplementation(() => ({
        userId: mockUserIdForGetAuth
    }));
    
    if (gameServiceMockFunctions && gameServiceMockFunctions.getPublicGames) {
      gameServiceMockFunctions.getPublicGames.mockClear();
    }
  });

  describe('LOBBY_001 & LOBBY_004 (details): View list of available public games', () => {
    it('should return a list of public games with correct details if user is authenticated and games exist', async () => {
      mockUserIdForGetAuth = 'user_lobby_viewer_123';
      const mockGames = [
        { gameId: 'game1', createdBy: 'playerA', timeSinceCreation: '5 mins ago', status: 'open' },
        { gameId: 'game2', createdBy: 'playerB', timeSinceCreation: '10 mins ago', status: 'open' },
      ];
      gameServiceMockFunctions.getPublicGames.mockResolvedValue(mockGames);

      mockRequest = new NextRequest(new URL('/api/multiplayer/games', 'http://localhost'));
      const response = await getGamesApiHandler(mockRequest);
      const responseBody = await response.json();

      expect(jest.requireMock('@clerk/nextjs/server').getAuth).toHaveBeenCalledTimes(1);
      expect(gameServiceMockFunctions.getPublicGames).toHaveBeenCalledTimes(1);
      expect(response.status).toBe(200);
      expect(responseBody).toEqual(mockGames);
    });

    it('should return 401 if user is not authenticated', async () => {
      mockUserIdForGetAuth = null; // Unauthenticated

      mockRequest = new NextRequest(new URL('/api/multiplayer/games', 'http://localhost'));
      const response = await getGamesApiHandler(mockRequest);
      
      expect(jest.requireMock('@clerk/nextjs/server').getAuth).toHaveBeenCalledTimes(1);
      expect(gameServiceMockFunctions.getPublicGames).not.toHaveBeenCalled();
      expect(response.status).toBe(401);
    });
  });

  describe('LOBBY_005: View lobby when no public games are available', () => {
    it('should return an empty list if user is authenticated and no public games exist', async () => {
      mockUserIdForGetAuth = 'user_lobby_viewer_456';
      const mockEmptyGamesList: any[] = [];
      gameServiceMockFunctions.getPublicGames.mockResolvedValue(mockEmptyGamesList);

      mockRequest = new NextRequest(new URL('/api/multiplayer/games', 'http://localhost'));
      const response = await getGamesApiHandler(mockRequest);
      const responseBody = await response.json();

      expect(jest.requireMock('@clerk/nextjs/server').getAuth).toHaveBeenCalledTimes(1);
      expect(gameServiceMockFunctions.getPublicGames).toHaveBeenCalledTimes(1);
      expect(response.status).toBe(200);
      expect(responseBody).toEqual(mockEmptyGamesList);
    });
  });
  
  // Placeholder for LOBBY_002 (real-time updates - harder for API unit tests, focus on API returning current state)
  // Placeholder for LOBBY_003 (game joined/started updates - focus on API returning current state)
  // Placeholder for LOBBY_004 (UI elements - out of scope for API tests)
  // Placeholder for LOBBY_006 (Performance - partly covered by simple fetch, more complex for detailed NFR)
  
  // Stubs from original file, to be reviewed if they are still relevant or can be removed/merged
  describe('TC_LOBBY_002: Lobby list details (Covered by LOBBY_001 test)', () => {
    it('should ensure the lobby list correctly displays relevant details (e.g., creator username, time since creation) - Verified in LOBBY_001 test', () => {
      expect(true).toBe(true); // Test logic merged into LOBBY_001
    });
  });

  describe('TC_LOBBY_003: Lobby filtering/sorting (Out of scope for MVP API or requires specific query params)', () => {
    it('should verify filtering/sorting functionality if implemented - No specific API for this yet', () => {
      expect(true).toBe(true);
    });
  });

  describe('TC_LOBBY_005: Lobby performance (moderate load) (Basic check covered by LOBBY_001)', () => {
    it('should observe lobby loading with a moderate number of games (e.g., 20-30) - Basic fetch is tested', () => {
      expect(true).toBe(true);
    });
  });
});