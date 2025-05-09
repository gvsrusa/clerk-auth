import { NextResponse, type NextRequest } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { GameService } from '../../../../services/gameService'; // Corrected path

// Define a custom error class for user not found, aligning with test mocks.
// In a real scenario, this might be imported from gameService or a shared error module.
class UserNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserNotFoundError';
  }
}
export async function POST(request: NextRequest) {
  try {
    const { userId } = getAuth(request);

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json(); // Expecting { gameType: 'public', ...otherOptions }

    // Pass userId and the body (which contains gameOptions like gameType)
    const game = await GameService.createPublicGame(userId, body);

    return NextResponse.json(game, { status: 201 }); // 201 Created
  } catch (error: any) { // Added :any to access error.name safely
    console.error('Error creating game:', error);
    if (error.name === 'UserNotFoundError') {
      return NextResponse.json({ error: error.message || 'Invited user not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}
export async function GET(request: NextRequest) {
  try {
    const { userId } = getAuth(request);

    if (!userId) {
      // As per AUTH_001/AUTH_002, multiplayer features require login.
      // Middleware should protect the route, but API can also double-check.
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const games = await GameService.getPublicGames();
    return NextResponse.json(games, { status: 200 });
  } catch (error) {
    console.error('Error fetching public games:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}