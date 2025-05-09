import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import SinglePlayerPage from './page';

// Mock useRouter
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock Clerk auth (default to signed-in state)
const mockUseUser = jest.fn();
jest.mock('@clerk/nextjs', () => ({
  useUser: () => mockUseUser(),
}));

describe('Single Player Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseUser.mockReturnValue({
      isSignedIn: true,
      user: {
        id: 'user123',
        username: 'testplayer',
        getFullName: () => 'Test Player',
      },
    });
  });

  it('should render the title and difficulty options', () => {
    render(<SinglePlayerPage />);
    
    expect(screen.getByText(/Play Against Computer/i)).toBeInTheDocument();
    expect(screen.getByText(/Select Difficulty/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Easy/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Medium/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Hard/i })).toBeInTheDocument();
  });

  it('should allow selecting player color', () => {
    render(<SinglePlayerPage />);
    
    expect(screen.getByText(/Choose Your Color/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/White/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Black/i)).toBeInTheDocument();
  });

  it('should navigate to game page with selected options when starting a new game', () => {
    render(<SinglePlayerPage />);
    
    // Select difficulty and color
    fireEvent.click(screen.getByRole('button', { name: /Hard/i }));
    fireEvent.click(screen.getByLabelText(/Black/i));
    
    // Start the game
    fireEvent.click(screen.getByRole('button', { name: /Start Game/i }));
    
    // Check navigation with correct query parameters
    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining('/single-player/game?difficulty=hard&playerColor=black')
    );
  });

  it('should have default selections (medium difficulty and white color)', () => {
    render(<SinglePlayerPage />);
    
    // Start with default selections
    fireEvent.click(screen.getByRole('button', { name: /Start Game/i }));
    
    // Should use defaults: medium difficulty and white color
    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining('/single-player/game?difficulty=medium&playerColor=white')
    );
  });

  it('should display optional game settings', () => {
    render(<SinglePlayerPage />);
    
    expect(screen.getByText(/Game Settings/i)).toBeInTheDocument();
    expect(screen.getByText(/Enable Hints/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Enable Position Analysis/i)).toBeInTheDocument();
  });

  it('should include optional settings in navigation when selected', () => {
    render(<SinglePlayerPage />);
    
    // Enable hints and analysis
    fireEvent.click(screen.getByLabelText(/Enable Hints/i));
    fireEvent.click(screen.getByLabelText(/Enable Position Analysis/i));
    
    // Start the game
    fireEvent.click(screen.getByRole('button', { name: /Start Game/i }));
    
    // Check that options are included in navigation
    expect(mockPush).toHaveBeenCalledWith(
      expect.stringMatching(/hints=true/)
    );
    expect(mockPush).toHaveBeenCalledWith(
      expect.stringMatching(/analysis=true/)
    );
  });

  it('should show a link to return to the main page', () => {
    render(<SinglePlayerPage />);
    
    expect(screen.getByText(/Return to Home/i)).toBeInTheDocument();
    
    // Click the link
    fireEvent.click(screen.getByText(/Return to Home/i));
    
    // Should navigate to homepage
    expect(mockPush).toHaveBeenCalledWith('/');
  });
});