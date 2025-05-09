// Type definitions for stockfish
declare module 'stockfish' {
  interface StockfishEngine {
    /**
     * Post a message to the engine
     * @param message The message to send
     */
    postMessage(message: string): void;
    
    /**
     * Event handler for messages from the engine
     */
    onmessage: (event: { data: string }) => void;
  }
  
  /**
   * Stockfish engine factory function
   * @returns A Stockfish engine instance
   */
  export default function(): StockfishEngine;
}

// Type definitions for extension of global objects
interface Window {
  /**
   * Optional property for Stockfish WASM instance
   */
  Stockfish?: {
    new(): {
      addMessageListener: (callback: (message: string) => void) => void;
      postMessage: (message: string) => void;
    };
  };
}