// src/app/multiplayer/game-creation.test.ts
import { NextRequest, NextResponse } from 'next/server';
import middleware from '../../middleware'; // For auth checks
// Import the POST handler from the yet-to-be-created API route
import { POST as createGameApiHandler } from '../api/multiplayer/games/route'; // Adjust path as needed

// Mock Clerk and its handler
interface MockAuthProtect { // For middleware's clerkMiddleware
  protect: jest.Mock;
}
interface MockGetAuth { // For API route's getAuth
  userId: string | null;
}

const mockAuthObjectForClerkHandler: MockAuthProtect = { // Used by clerkMiddleware mock
  protect: jest.fn(),
};

let mockUserIdForGetAuth: string | null = null; // Used by getAuth mock

jest.mock('@clerk/nextjs/server', () => {
  const originalModule = jest.requireActual('@clerk/nextjs/server');
  return {
    __esModule: true,
    ...originalModule,
    clerkMiddleware: jest.fn( // For middleware tests
      (handler: (auth: MockAuthProtect, req: NextRequest) => any) => {
        return (req: NextRequest) => {
          // Pass the protect mock to the handler the middleware uses
          return handler(mockAuthObjectForClerkHandler, req);
        };
      }
    ),
    getAuth: jest.fn(() => ({ userId: mockUserIdForGetAuth })), // For API route tests
  };
});

// Define the actual mock function instance(s) for GameService methods at the top level.
// This ensures they are initialized before the jest.mock factory function runs.
const mockCreatePublicGame = jest.fn();
// If GameService had other methods to mock for this file, define their mocks here:
// const mockAnotherGameServiceMethod = jest.fn();

// Mock the GameService module.
// The factory function will now use the top-level mock functions defined above.
jest.mock('../../services/gameService', () => {
  return {
    GameService: {
      createPublicGame: mockCreatePublicGame, // Use the top-level mock function
      // Map other GameService methods to their respective top-level mocks if needed:
      // anotherMethod: mockAnotherGameServiceMethod,
    },
  };
});

describe('Multiplayer Feature: Game Creation (US1, AC1, FR2)', () => {
  let mockRequest: NextRequest;

  beforeEach(() => {
    // Clear mocks for clerkMiddleware path
    mockAuthObjectForClerkHandler.protect.mockClear();
    (jest.requireMock('@clerk/nextjs/server').clerkMiddleware as jest.Mock).mockClear();

    // Clear and setup mocks for getAuth path (API routes)
    mockUserIdForGetAuth = null;
    (jest.requireMock('@clerk/nextjs/server').getAuth as jest.Mock).mockClear().mockImplementation(() => ({
        userId: mockUserIdForGetAuth
    }));
    
    // Clear the top-level mock function for GameService.createPublicGame
    mockCreatePublicGame.mockClear();
    // If other GameService methods were mocked, clear them here too:
    // mockAnotherGameServiceMethod.mockClear();
  });

  describe('GC_004: Attempt to create a game when not logged in (Middleware Check)', () => {
    it('should redirect to login if an unauthenticated user tries to access a protected game creation page', async () => {
      mockUserIdForGetAuth = null; // For getAuth if it were called, but middleware uses protect
      mockAuthObjectForClerkHandler.protect.mockImplementation(() => { // Middleware uses protect
        return NextResponse.redirect(new URL('http://localhost/sign-in'));
      });
      
      // This test targets a page like /multiplayer/create protected by middleware
      mockRequest = new NextRequest(new URL('/multiplayer/create', 'http://localhost'));
      const response = await middleware(mockRequest, {} as any);

      expect(mockAuthObjectForClerkHandler.protect).toHaveBeenCalledTimes(1);
      expect(response).toBeInstanceOf(NextResponse);
      if (response instanceof NextResponse) {
        expect(response.status).toBe(307);
        expect(response.headers.get('Location')).toBe('http://localhost/sign-in');
      }
      expect(mockCreatePublicGame).not.toHaveBeenCalled();
    });
  });

  describe('TC_GC_001: Authenticated user can create a public game (API Route Check)', () => {
    it('should allow a logged-in user to create a public game via API and call the game service', async () => {
      mockUserIdForGetAuth = 'user_creator_123'; // Set for getAuth used by API route handler
      
      const mockGameDetails = { gameId: 'game_abc_123', type: 'public', creator: 'user_creator_123' };
      mockCreatePublicGame.mockResolvedValue(mockGameDetails);

      // Simulate a POST request to the API endpoint
      mockRequest = new NextRequest(new URL('/api/multiplayer/games', 'http://localhost'), {
        method: 'POST',
        body: JSON.stringify({ gameType: 'public' }), // Example body
        headers: { 'Content-Type': 'application/json' },
      });

      // Call the actual API route handler function (which is imported)
      const response = await createGameApiHandler(mockRequest);
      const responseBody = await response.json();

      // Assertions
      expect(mockCreatePublicGame).toHaveBeenCalledTimes(1);
      expect(mockCreatePublicGame).toHaveBeenCalledWith(
        'user_creator_123', // First argument is userId
        { gameType: 'public' } // Second argument is the request body
      );
      
      expect(response.status).toBe(201);
      expect(responseBody).toEqual(mockGameDetails);
    });

    it('should return 401 if an unauthenticated user tries to create a game via API', async () => {
      mockUserIdForGetAuth = null; // Set for getAuth used by API route handler

      mockRequest = new NextRequest(new URL('/api/multiplayer/games', 'http://localhost'), {
        method: 'POST',
        body: JSON.stringify({ gameType: 'public' }),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await createGameApiHandler(mockRequest);

      expect(response.status).toBe(401);
      expect(mockCreatePublicGame).not.toHaveBeenCalled();
    });
  });

  describe('TC_GC_002: Authenticated user can create a private game (API Route Check)', () => {
    it('should allow a logged-in user to create a private game via API', async () => {
      mockUserIdForGetAuth = 'user_creator_private_456';
      const requestBody = { gameType: 'private' };
      const mockGameDetails = {
        gameId: 'game_pvt_789',
        type: 'private',
        createdBy: mockUserIdForGetAuth,
        status: 'created',
      };
      // Ensure the mock service returns the correct type based on options
      mockCreatePublicGame.mockImplementation(async (userId, options) => ({
        gameId: `game_pvt_${Date.now()}`,
        status: 'created',
        createdBy: userId,
        type: options?.gameType || 'public', // Mock service should respect gameType
      }));
      // Note: The mockResolvedValue below will override the mockImplementation for this specific call if not cleared.
      // For this test, mockResolvedValue is more direct for the expected outcome.
      mockCreatePublicGame.mockResolvedValue(mockGameDetails);


      mockRequest = new NextRequest(new URL('/api/multiplayer/games', 'http://localhost'), {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await createGameApiHandler(mockRequest);
      const responseBody = await response.json();

      expect(mockCreatePublicGame).toHaveBeenCalledTimes(1);
      expect(mockCreatePublicGame).toHaveBeenCalledWith(mockUserIdForGetAuth, requestBody);
      expect(response.status).toBe(201);
      expect(responseBody).toEqual(mockGameDetails);
      expect(responseBody.type).toBe('private');
    });
  });

  describe('TC_GC_005: Create a private game by inviting a specific user (API Route Check)', () => {
    it('should allow a logged-in user to create a private game with an invitee', async () => {
      mockUserIdForGetAuth = 'user_inviter_789';
      const inviteeUsername = 'user_invited_101';
      const requestBody = { gameType: 'private', inviteeUsername };
      const mockGameDetails = {
        gameId: 'game_pvt_invite_123',
        type: 'private',
        createdBy: mockUserIdForGetAuth,
        status: 'pending_invite', // Or similar status
        invitedUser: inviteeUsername,
      };
      
      // Adjust mock to potentially include invitee information if service supports it
      mockCreatePublicGame.mockImplementation(async (userId, options) => ({
        gameId: `game_pvt_invite_${Date.now()}`,
        status: options?.inviteeUsername ? 'pending_invite' : 'created',
        createdBy: userId,
        type: options?.gameType || 'public',
        invitedUser: options?.inviteeUsername || undefined,
      }));
      // Similar to above, mockResolvedValue is more direct here.
      mockCreatePublicGame.mockResolvedValue(mockGameDetails);

      mockRequest = new NextRequest(new URL('/api/multiplayer/games', 'http://localhost'), {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await createGameApiHandler(mockRequest);
      const responseBody = await response.json();

      expect(mockCreatePublicGame).toHaveBeenCalledTimes(1);
      expect(mockCreatePublicGame).toHaveBeenCalledWith(mockUserIdForGetAuth, requestBody);
      expect(response.status).toBe(201);
      expect(responseBody).toEqual(mockGameDetails);
      expect(responseBody.invitedUser).toBe(inviteeUsername);
    });
  });

  describe('TC_GC_006: Attempt to invite a non-existent user to a private game (API Route Check)', () => {
    it('should return a 400/404 error if attempting to invite a non-existent user', async () => {
      mockUserIdForGetAuth = 'user_inviter_error_111';
      const nonExistentInvitee = 'user_nonexistent_222';
      const requestBody = { gameType: 'private', inviteeUsername: nonExistentInvitee };
      
      class UserNotFoundError extends Error {
        constructor(message: string) {
          super(message);
          this.name = 'UserNotFoundError';
        }
      }
      mockCreatePublicGame.mockRejectedValue(new UserNotFoundError('Invited user not found'));
      
      mockRequest = new NextRequest(new URL('/api/multiplayer/games', 'http://localhost'), {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await createGameApiHandler(mockRequest);
      const responseBody = await response.json();

      expect(mockCreatePublicGame).toHaveBeenCalledTimes(1);
      expect(mockCreatePublicGame).toHaveBeenCalledWith(mockUserIdForGetAuth, requestBody);
      
      expect(response.status).toBe(404);
      expect(responseBody.error).toContain('Invited user not found');
    });
  });
});