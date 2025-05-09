/**
 * Audio utilities for the chess application
 * Optimized with error handling and fallbacks
 */

// Audio cache to prevent reloading and improve performance
const audioCache = new Map<string, HTMLAudioElement>();

/**
 * Error class for audio-related issues
 */
export class AudioError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AudioError';
  }
}

/**
 * Play a sound with error handling and fallbacks
 * @param soundPath Path to the sound file
 * @param volume Optional volume level (0-1)
 * @returns Promise that resolves when the sound starts playing
 */
export const playSound = async (soundPath: string, volume = 1.0): Promise<void> => {
  try {
    // Skip audio in test environment
    if (typeof window === 'undefined' || process.env.JEST_WORKER_ID) {
      return Promise.resolve();
    }
    
    // Check if audio is enabled (user preference)
    const soundEnabled = localStorage.getItem('soundEnabled') !== 'false';
    if (!soundEnabled) {
      return Promise.resolve();
    }
    
    // Use cached audio if available
    let audio = audioCache.get(soundPath);
    
    if (!audio) {
      // Create and cache new audio element
      audio = new Audio();
      
      // Add error handling for the 416 Range Not Satisfiable errors
      audio.onerror = (e) => {
        console.warn(`Error playing sound ${soundPath}:`, e);
        // Remove from cache if there was a loading error
        audioCache.delete(soundPath);
      };
      
      // Only set the source once to avoid repeated loading
      audio.src = soundPath;
      
      // Preload the audio
      audio.load();
      
      // Add to cache
      audioCache.set(soundPath, audio);
    }
    
    // Reset audio position and set volume
    audio.currentTime = 0;
    audio.volume = volume;
    
    // Play the sound with a fallback for browsers that don't support Promises
    try {
      await audio.play();
    } catch (error) {
      // Handle autoplay policy restrictions
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        console.warn('Audio playback was prevented by browser autoplay policy');
        return;
      }
      
      // Some browsers may not support the promise-based API
      console.warn('Using fallback for audio playback');
      audio.play();
    }
  } catch (error) {
    console.warn('Failed to play sound:', error);
    // Don't throw errors for sound failures - treat them as non-critical
  }
};

/**
 * Play the move sound effect
 * @returns Promise that resolves when the sound starts playing
 */
export const playMoveSound = (): Promise<void> => {
  return playSound('/move-sound.mp3', 0.7);
};

/**
 * Play the capture sound effect
 * @returns Promise that resolves when the sound starts playing
 */
export const playCaptureSound = (): Promise<void> => {
  return playSound('/capture-sound.mp3', 0.8);
};

/**
 * Play the check sound effect
 * @returns Promise that resolves when the sound starts playing
 */
export const playCheckSound = (): Promise<void> => {
  return playSound('/check-sound.mp3', 0.9);
};

/**
 * Play the game end sound effect
 * @returns Promise that resolves when the sound starts playing
 */
export const playGameEndSound = (): Promise<void> => {
  return playSound('/game-end-sound.mp3', 1.0);
};

/**
 * Clean up cached audio resources to prevent memory leaks
 */
export const cleanupAudioResources = (): void => {
  audioCache.forEach((audio) => {
    try {
      audio.pause();
      audio.src = '';
    } catch (e) {
      console.warn('Error cleaning up audio:', e);
    }
  });
  audioCache.clear();
};

export default {
  playSound,
  playMoveSound,
  playCaptureSound,
  playCheckSound,
  playGameEndSound,
  cleanupAudioResources,
};