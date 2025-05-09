# Chess Application

A full-featured chess application with both single-player and multiplayer capabilities, built with Next.js and featuring secure authentication with Clerk.

## Features

### Single-Player Mode
- **Play Against Computer**: Challenge the Stockfish chess engine
- **Adjustable Difficulty**: Choose from multiple AI difficulty levels
- **Game Customization**: Play as white or black pieces
- **Assistance Features**: Get hints and position analysis
- **Game Controls**: Undo moves, save/load games, and start new games

### Multiplayer Mode
- **Real-time Multiplayer Chess**: Play chess with opponents in real-time
- **Secure Authentication**: User authentication powered by Clerk
- **Game Lobby**: Create and join public or private games
- **Game History**: Review your past games
- **Special Features**:
  - Draw offers
  - Resignations
  - Move validation and synchronization
  - Turn notifications

## Architecture

The application consists of the following components:

- **Next.js Frontend**: React-based UI with server-side rendering
- **Socket.IO Backend**: Real-time communication server for multiplayer game synchronization
- **Stockfish Integration**: Chess engine for single-player mode
- **PostgreSQL Database**: Persistent storage for games, moves, and user data
- **Clerk Authentication**: Secure user authentication and management

## Getting Started

### Prerequisites

- Node.js 18.x or later
- npm 9.x or later
- PostgreSQL 14.x or later

### Development Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/chess-app.git
   cd chess-app
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. Start the development server:
   ```bash
   npm run dev-all
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Deployment

For production deployment, follow our comprehensive deployment guides:

- [Prerequisites](docs/deployment/prerequisites.md)
- [Environment Setup](docs/deployment/environment-setup.md)
- [Database Configuration](docs/deployment/database-configuration.md)
- [Production Configuration](docs/deployment/production-configuration.md)
- [Security Implementation](docs/deployment/security-implementation.md)

## Documentation

### User Guide

- [Authentication](docs/user-guide/authentication.md)
- [Creating Games](docs/user-guide/creating-games.md)
- [Joining Games](docs/user-guide/joining-games.md)
- [Gameplay](docs/user-guide/gameplay.md)
- [Special Features](docs/user-guide/special-features.md)

### Maintenance Guide

- [Monitoring Recommendations](docs/maintenance/monitoring.md)
- [Backup Procedures](docs/maintenance/backup.md)
- [Update Workflows](docs/maintenance/updates.md)
- [Troubleshooting Common Issues](docs/maintenance/troubleshooting.md)

## Technology Stack

- **Frontend**: Next.js, React, TypeScript
- **Backend**: Node.js, Socket.IO
- **Chess Logic**: chess.js
- **AI Engine**: Stockfish
- **Database**: PostgreSQL
- **Authentication**: Clerk
- **Deployment**: PM2, Nginx, Ubuntu

## Security

This application has undergone a comprehensive security audit. The identified security considerations have been addressed in the [Security Implementation](docs/deployment/security-implementation.md) documentation.

## Performance Optimization

The application has been optimized for performance based on specific recommendations for multiplayer functionality. The optimizations include:

- Database query optimization
- Connection pooling
- WebSocket message optimization
- Caching strategies

For more details, see the [optimization reports](docs/reports/optimization_summary.md).

## Testing

The application includes a comprehensive test suite covering both single-player and multiplayer functionality:

### Multiplayer Tests (68 tests across 12 files):
- Authentication
- Game creation and joining
- Move synchronization
- Turn notifications
- Draw offers
- Resignations

### Single-Player Tests:
- Stockfish service integration
- Single-player UI components
- Game board interaction
- AI move generation

To run tests:

```bash
npm test
```

## Contributing

Contributions are welcome! Please read our [contributing guidelines](CONTRIBUTING.md) before submitting a pull request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Next.js](https://nextjs.org) - The React framework for production
- [Socket.IO](https://socket.io) - Real-time engine
- [Clerk](https://clerk.dev) - Authentication and user management
- [chess.js](https://github.com/jhlywa/chess.js) - Chess logic implementation
- [Stockfish](https://stockfishchess.org) - Open source chess engine
