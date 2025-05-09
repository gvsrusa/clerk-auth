/**
 * Audio utilities for the chess application
 * Optimized with error handling and fallbacks
 */

// Using Web Audio API instead of HTML Audio elements

/**
 * Error class for audio-related issues
 */
export class AudioError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AudioError';
  }
}

// AudioContext cache to prevent creating multiple instances
let audioContext: AudioContext | null = null;

// Default fallback sound for chess moves - a short "click" sound
const FALLBACK_CHESS_MOVE_SOUND = [
  0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x10, 0x00, 0x00, 0x20, 0x00, 0x00, 0x10, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x08, 0x00, 0x00, 0x00, 0x64, 0x61, 0x74, 0x61,
  0x24, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x80, 0xff, 0xff, 0xff, 0x7f, 0x01, 0x00, 0x00, 0x80,
  0xfe, 0xff, 0xff, 0x7f, 0x02, 0x00, 0x00, 0x80, 0xfd, 0xff, 0xff, 0x7f, 0x03, 0x00, 0x00, 0x80
];

/**
 * Play a sound with robust error handling using Web Audio API
 * This avoids the 416 Range Not Satisfiable errors that occur with HTML Audio elements
 *
 * @param soundPath Path to the sound file (used as a fallback)
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
    
    // Create AudioContext if it doesn't exist
    if (!audioContext) {
      try {
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch (e) {
        console.warn('AudioContext not supported, falling back to silent mode');
        return Promise.resolve();
      }
    }
    
    // Use the Web Audio API instead of HTML Audio element
    const audioCtx = audioContext;
    
    // Create a short "click" sound buffer rather than loading an external file
    // This avoids all the network issues with loading audio files
    try {
      // Create an oscillator for a simple tone
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      // Configure oscillator
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(800, audioCtx.currentTime); // Higher pitch for move sound
      
      // Configure gain (volume)
      gainNode.gain.setValueAtTime(volume * 0.3, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.1);
      
      // Connect nodes
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      // Play sound
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.1);
      
      return Promise.resolve();
    } catch (audioError) {
      console.warn('Error playing sound with Web Audio API:', audioError);
      
      // If oscillator approach fails, try a fallback with a pre-defined buffer
      try {
        // Create buffer with pre-defined sound data
        const buffer = audioCtx.createBuffer(1, 44100 * 0.1, 44100);
        const channelData = buffer.getChannelData(0);
        
        // Fill buffer with a simple click sound
        for (let i = 0; i < channelData.length; i++) {
          // Decaying sine wave
          channelData[i] = Math.sin(i * 0.1) * Math.exp(-i / (44100 * 0.05)) * 0.5;
        }
        
        // Play the buffer
        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        
        // Add volume control
        const gainNode = audioCtx.createGain();
        gainNode.gain.value = volume;
        
        // Connect nodes
        source.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        // Play sound
        source.start();
        
        return Promise.resolve();
      } catch (bufferError) {
        console.warn('Error playing fallback sound buffer:', bufferError);
        return Promise.resolve();
      }
    }
  } catch (error) {
    console.warn('Failed to play sound:', error);
    // Don't throw errors for sound failures - treat them as non-critical
    return Promise.resolve();
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
 * Clean up audio resources to prevent memory leaks
 */
export const cleanupAudioResources = (): void => {
  try {
    // Close AudioContext if it exists
    if (audioContext) {
      if (audioContext.state !== 'closed') {
        audioContext.close().catch(e => {
          console.warn('Error closing AudioContext:', e);
        });
      }
      audioContext = null;
    }
  } catch (e) {
    console.warn('Error cleaning up audio resources:', e);
  }
};

export default {
  playSound,
  playMoveSound,
  playCaptureSound,
  playCheckSound,
  playGameEndSound,
  cleanupAudioResources,
};