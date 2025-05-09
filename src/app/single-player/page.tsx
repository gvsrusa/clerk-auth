'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import Image from 'next/image';

export default function SinglePlayerPage() {
  const router = useRouter();
  const { isSignedIn, user } = useUser();
  
  // Game settings state
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [playerColor, setPlayerColor] = useState<'white' | 'black'>('white');
  const [enableHints, setEnableHints] = useState<boolean>(false);
  const [enableAnalysis, setEnableAnalysis] = useState<boolean>(false);
  
  // Handle starting a new game
  const startGame = () => {
    // Construct the query parameters
    const params = new URLSearchParams();
    params.append('difficulty', difficulty);
    params.append('playerColor', playerColor);
    
    if (enableHints) {
      params.append('hints', 'true');
    }
    
    if (enableAnalysis) {
      params.append('analysis', 'true');
    }
    
    // Navigate to the game page with the selected options
    router.push(`/single-player/game?${params.toString()}`);
  };
  
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--ui-hover)] p-4">
      <div className="bg-[var(--ui-card-bg)] rounded-lg shadow-lg p-8 max-w-md w-full">
        <h1 className="text-3xl font-bold text-center mb-8">Play Against Computer</h1>
        
        {/* Difficulty Selection */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Select Difficulty</h2>
          <div className="grid grid-cols-3 gap-4">
            <button
              onClick={() => setDifficulty('easy')}
              className={`py-2 px-4 rounded-md ${
                difficulty === 'easy'
                  ? 'bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)]'
                  : 'bg-[var(--btn-secondary-bg)] text-[var(--btn-secondary-text)] hover:bg-[var(--btn-secondary-hover)]'
              }`}
            >
              Easy
            </button>
            <button
              onClick={() => setDifficulty('medium')}
              className={`py-2 px-4 rounded-md ${
                difficulty === 'medium'
                  ? 'bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)]'
                  : 'bg-[var(--btn-secondary-bg)] text-[var(--btn-secondary-text)] hover:bg-[var(--btn-secondary-hover)]'
              }`}
            >
              Medium
            </button>
            <button
              onClick={() => setDifficulty('hard')}
              className={`py-2 px-4 rounded-md ${
                difficulty === 'hard'
                  ? 'bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)]'
                  : 'bg-[var(--btn-secondary-bg)] text-[var(--btn-secondary-text)] hover:bg-[var(--btn-secondary-hover)]'
              }`}
            >
              Hard
            </button>
          </div>
        </div>
        
        {/* Color Selection */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Choose Your Color</h2>
          <div className="flex justify-around">
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                name="color"
                checked={playerColor === 'white'}
                onChange={() => setPlayerColor('white')}
                className="hidden"
              />
              <div className={`p-4 rounded-md border-2 ${
                playerColor === 'white'
                  ? 'border-[var(--btn-primary-bg)]'
                  : 'border-[var(--ui-border)]'
              }`}>
                <div className="w-12 h-12 bg-white rounded-full shadow border border-[var(--ui-border)] flex items-center justify-center">
                  ♔
                </div>
                <span className="block text-center mt-2">White</span>
              </div>
            </label>
            
            <label className="flex items-center cursor-pointer">
              <input
                type="radio"
                name="color"
                checked={playerColor === 'black'}
                onChange={() => setPlayerColor('black')}
                className="hidden"
              />
              <div className={`p-4 rounded-md border-2 ${
                playerColor === 'black'
                  ? 'border-[var(--btn-primary-bg)]'
                  : 'border-[var(--ui-border)]'
              }`}>
                <div className="w-12 h-12 bg-[var(--chess-black-piece)] rounded-full shadow border border-[var(--ui-border)] flex items-center justify-center text-white">
                  ♚
                </div>
                <span className="block text-center mt-2">Black</span>
              </div>
            </label>
          </div>
        </div>
        
        {/* Game Settings */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Game Settings</h2>
          <div className="space-y-4">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={enableHints}
                onChange={() => setEnableHints(!enableHints)}
                className="form-checkbox h-5 w-5 text-[var(--btn-primary-bg)] rounded"
              />
              <span>Enable Hints</span>
            </label>
            
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={enableAnalysis}
                onChange={() => setEnableAnalysis(!enableAnalysis)}
                className="form-checkbox h-5 w-5 text-[var(--btn-primary-bg)] rounded"
              />
              <span>Enable Position Analysis</span>
            </label>
          </div>
        </div>
        
        {/* Start Game Button */}
        <button
          onClick={startGame}
          className="w-full py-3 px-4 bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] font-semibold rounded-lg shadow hover:bg-[var(--btn-primary-hover)] transition duration-200"
        >
          Start Game
        </button>
        
        {/* Return to Homepage */}
        <div className="mt-6 text-center">
          <Link href="/" className="text-[var(--status-info)] hover:underline">
            Return to Home
          </Link>
        </div>
      </div>
    </div>
  );
}