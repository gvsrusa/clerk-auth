'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { GameService, Game } from '../../../services/gameService';

export default function GameHistoryPage() {
  const { user, isSignedIn, isLoaded } = useUser();
  const router = useRouter();
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoaded && isSignedIn && user) {
      loadGameHistory();
    }
  }, [isLoaded, isSignedIn, user]);

  const loadGameHistory = async () => {
    try {
      setLoading(true);
      const gameHistory = await GameService.getUserGameHistory(user!.id);
      setGames(gameHistory);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load game history');
      console.error('Error loading game history:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReturnToLobby = () => {
    router.push('/multiplayer');
  };

  // Show loading state if user info is still loading
  if (!isLoaded) {
    return <div className="p-6">Loading user information...</div>;
  }

  // Require sign-in to access history
  if (isLoaded && !isSignedIn) {
    return (
      <div className="p-6">
        <h1 className="text-3xl font-bold mb-4">Game History</h1>
        <p className="mb-4">You must be signed in to view your game history.</p>
        <a href="/sign-in" className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded">
          Sign In
        </a>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-4">Your Game History</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      <div className="mb-6">
        <button
          onClick={handleReturnToLobby}
          className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded"
        >
          Return to Lobby
        </button>
      </div>
      
      {loading ? (
        <div className="text-center py-8">Loading game history...</div>
      ) : games.length === 0 ? (
        <div className="bg-gray-100 p-4 rounded text-center">
          <p>You haven't played any games yet. Join or create a game to get started!</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Game
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Opponent
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Your Color
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Result
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {games.map((game) => {
                // Find the current user's player info
                const currentPlayer = game.players.find(p => p.userId === user!.id);
                // Find the opponent's player info
                const opponent = game.players.find(p => p.userId !== user!.id);
                
                // Determine game result
                let result = '';
                if (game.status === 'checkmate' || game.status === 'resigned') {
                  if (game.winner === user!.id) {
                    result = 'Won';
                  } else {
                    result = 'Lost';
                  }
                } else if (game.status === 'stalemate' || game.status === 'draw') {
                  result = 'Draw';
                }
                
                return (
                  <tr key={game.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      Game #{game.id.substring(5, 10)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {opponent ? opponent.username : 'Unknown'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {currentPlayer ? (
                        <div className="flex items-center">
                          <div 
                            className={`w-3 h-3 rounded-full mr-2 ${currentPlayer.color === 'white' ? 'bg-white border border-gray-400' : 'bg-black'}`}
                          ></div>
                          {currentPlayer.color.charAt(0).toUpperCase() + currentPlayer.color.slice(1)}
                        </div>
                      ) : 'Unknown'}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium
                      ${result === 'Won' ? 'text-green-600' : 
                        result === 'Lost' ? 'text-red-600' : 
                        'text-yellow-600'}`}>
                      {result}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(game.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}