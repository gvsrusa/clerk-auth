'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { GameService, Game } from '../../services/gameService';

export default function MultiplayerPage() {
  const { user, isSignedIn, isLoaded } = useUser();
  const router = useRouter();
  const [publicGames, setPublicGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [socket, setSocket] = useState<any>(null);
  const [gameType, setGameType] = useState<'public' | 'private'>('public');
  const [inviteeUsername, setInviteeUsername] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [userInvitations, setUserInvitations] = useState<any[]>([]);

  // Load public games when component mounts
  useEffect(() => {
    if (isLoaded && isSignedIn && user) {
      loadPublicGames();
      
      // Connect to socket server for real-time updates
      const newSocket = GameService.connectToSocket(user.id);
      setSocket(newSocket);
      
      // Listen for lobby updates
      newSocket.on('lobby:gamesListUpdated', (data: { games: Game[] }) => {
        setPublicGames(data.games);
      });
      
      // Listen for game invitations
      newSocket.on('user:invitedToGame', (data: { gameId: string, invitingUserName: string }) => {
        setUserInvitations(prev => [...prev, data]);
      });
      
      return () => {
        // Disconnect socket when component unmounts
        GameService.disconnectFromSocket();
      };
    }
  }, [isLoaded, isSignedIn, user]);

  const loadPublicGames = async () => {
    try {
      setLoading(true);
      const games = await GameService.getPublicGames();
      setPublicGames(games);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load games');
      console.error('Error loading games:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGame = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isSignedIn || !user) {
      setError('You must be signed in to create a game');
      return;
    }
    
    try {
      setLoading(true);
      const gameOptions: any = { gameType };
      
      if (gameType === 'private' && inviteeUsername) {
        gameOptions.inviteeUsername = inviteeUsername;
      }
      
      const newGame = await GameService.createPublicGame(user.id, gameOptions);
      
      // For private games with an invitation, stay on the lobby page and show a notification
      if (gameType === 'private' && inviteeUsername) {
        setError(null);
        setShowCreateForm(false);
        alert(`Invitation sent to ${inviteeUsername}`);
        return;
      }
      
      // For public games or private games without a specific invitee,
      // redirect to the game page to wait for an opponent
      router.push(`/multiplayer/game/${newGame.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create game');
      console.error('Error creating game:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinGame = async (gameId: string) => {
    if (!isSignedIn || !user) {
      setError('You must be signed in to join a game');
      return;
    }
    
    try {
      setLoading(true);
      await GameService.joinPublicGame(gameId, user.id);
      router.push(`/multiplayer/game/${gameId}`);
    } catch (err: any) {
      setError(err.message || 'Failed to join game');
      console.error('Error joining game:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptInvitation = async (gameId: string, invitationId: string) => {
    if (!isSignedIn || !user) {
      setError('You must be signed in to accept an invitation');
      return;
    }
    
    try {
      setLoading(true);
      await GameService.acceptInvitation(invitationId, user.id, gameId);
      
      // Remove this invitation from the list
      setUserInvitations(prev => prev.filter(inv => inv.gameId !== gameId));
      
      // Navigate to the game
      router.push(`/multiplayer/game/${gameId}`);
    } catch (err: any) {
      setError(err.message || 'Failed to accept invitation');
      console.error('Error accepting invitation:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeclineInvitation = (gameId: string) => {
    // Remove the invitation from the list
    setUserInvitations(prev => prev.filter(inv => inv.gameId !== gameId));
    
    // In a real app, you would also notify the inviter via socket
    if (socket) {
      socket.emit('game:invitationDeclined', { gameId, userId: user?.id });
    }
  };

  const handleViewGameHistory = () => {
    router.push('/multiplayer/history');
  };

  // Show loading message if still loading user info
  if (!isLoaded) {
    return <div className="p-6">Loading user information...</div>;
  }

  // Require sign-in to access multiplayer features
  if (isLoaded && !isSignedIn) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold mb-4">Multiplayer Chess</h1>
        <p className="mb-4">You must be signed in to access the multiplayer features.</p>
        <a href="/sign-in" className="bg-[var(--btn-primary-bg)] hover:bg-[var(--btn-primary-hover)] text-[var(--btn-primary-text)] py-2 px-4 rounded">
          Sign In
        </a>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-4">Multiplayer Chess Lobby</h1>
      
      {error && (
        <div className="bg-[var(--status-error-bg)] border border-[var(--status-error-border)] text-[var(--status-error)] px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold">Welcome, {user?.fullName || user?.username}</h2>
        
        <div className="flex space-x-3">
          <button
            onClick={handleViewGameHistory}
            className="bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover)] text-[var(--btn-secondary-text)] py-2 px-4 rounded"
          >
            View Game History
          </button>
          
          {!showCreateForm ? (
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-[var(--btn-success-bg)] hover:bg-[var(--btn-success-hover)] text-[var(--btn-success-text)] py-2 px-4 rounded"
            >
              Create New Game
            </button>
          ) : null}
        </div>
      </div>
      
      {showCreateForm && (
        <div className="bg-[var(--ui-card-bg)] p-4 rounded w-full max-w-md mb-6">
          <h3 className="text-lg font-semibold mb-2">Create New Game</h3>
          <form onSubmit={handleCreateGame}>
            <div className="mb-3">
              <label className="block mb-1">Game Type:</label>
              <select
                value={gameType}
                onChange={(e) => setGameType(e.target.value as 'public' | 'private')}
                className="w-full p-2 border border-[var(--ui-border)] rounded bg-[var(--ui-card-bg)]"
              >
                <option value="public">Public (Anyone can join)</option>
                <option value="private">Private</option>
              </select>
            </div>
            
            {gameType === 'private' && (
              <div className="mb-3">
                <label className="block mb-1">Invite User (Optional):</label>
                <input
                  type="text"
                  value={inviteeUsername}
                  onChange={(e) => setInviteeUsername(e.target.value)}
                  placeholder="Enter username"
                  className="w-full p-2 border border-[var(--ui-border)] rounded bg-[var(--ui-card-bg)]"
                />
              </div>
            )}
            
            <div className="flex space-x-2">
              <button
                type="submit"
                className="bg-[var(--btn-primary-bg)] hover:bg-[var(--btn-primary-hover)] text-[var(--btn-primary-text)] py-1 px-3 rounded"
                disabled={loading}
              >
                {loading ? 'Creating...' : 'Create Game'}
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="bg-[var(--btn-secondary-bg)] hover:bg-[var(--btn-secondary-hover)] text-[var(--btn-secondary-text)] py-1 px-3 rounded"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
      
      {/* Game Invitations Section */}
      {userInvitations.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2">Game Invitations</h2>
          <div className="bg-[var(--status-warning-bg)] p-4 rounded border border-[var(--status-warning-border)]">
            <ul className="divide-y">
              {userInvitations.map((invitation, index) => (
                <li key={index} className="py-3 flex justify-between items-center">
                  <div>
                    <span className="font-medium">{invitation.invitingUserName}</span> has invited you to play
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleAcceptInvitation(invitation.gameId, `invitation_${invitation.gameId}`)}
                      className="bg-[var(--btn-success-bg)] hover:bg-[var(--btn-success-hover)] text-[var(--btn-success-text)] py-1 px-3 rounded text-sm"
                      disabled={loading}
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => handleDeclineInvitation(invitation.gameId)}
                      className="bg-[var(--btn-danger-bg)] hover:bg-[var(--btn-danger-hover)] text-[var(--btn-danger-text)] py-1 px-3 rounded text-sm"
                    >
                      Decline
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      
      {/* Public Games List */}
      <div>
        <h2 className="text-xl font-semibold mb-2">Available Public Games</h2>
        
        {loading && !publicGames.length ? (
          <div className="text-center py-8">Loading games...</div>
        ) : publicGames.length === 0 ? (
          <div className="bg-[var(--ui-card-bg)] p-4 rounded text-center">
            <p>No public games available. Create a new game to get started!</p>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {publicGames.map((game) => (
              <div key={game.id} className="border rounded-lg p-4 bg-[var(--ui-card-bg)] shadow-sm">
                <div className="flex justify-between mb-2">
                  <span className="font-medium">Game #{game.id.substring(5, 10)}</span>
                  <span className="text-[var(--status-info)] text-sm">{game.timeSinceCreation}</span>
                </div>
                <div className="mb-2">
                  <span className="text-[var(--color-gray-600)]">Created by: </span>
                  <span>{game.players[0]?.username || 'Unknown'}</span>
                </div>
                <button
                  onClick={() => handleJoinGame(game.id)}
                  className="bg-[var(--btn-primary-bg)] hover:bg-[var(--btn-primary-hover)] text-[var(--btn-primary-text)] py-1 px-3 rounded w-full mt-2"
                  disabled={loading}
                >
                  Join Game
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}