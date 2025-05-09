# Security Implementation

This document provides instructions for implementing security measures based on the security audit of the Multiplayer Chess Application.

## Addressing Critical Vulnerabilities

### 1. WebSocket Authentication

The security audit identified that WebSocket connections lack proper authentication validation. This is being addressed by implementing token-based authentication.

#### Implementation Steps:

1. Install necessary dependencies:
   ```bash
   npm install jsonwebtoken
   npm install --save-dev @types/jsonwebtoken
   ```

2. Modify the WebSocket server (`src/server.js`) to verify authentication tokens:
   ```javascript
   const jwt = require('jsonwebtoken');
   const { Server } = require('socket.io');
   const http = require('http');
   
   // Create HTTP server
   const server = http.createServer();
   
   // Create Socket.IO server with proper CORS
   const io = new Server(server, {
     cors: {
       origin: process.env.NODE_ENV === 'production' 
         ? process.env.CORS_ORIGIN 
         : '*',
       methods: ['GET', 'POST'],
       credentials: true
     }
   });
   
   // Add authentication middleware
   io.use(async (socket, next) => {
     try {
       const token = socket.handshake.auth.token || socket.handshake.query.token;
       
       if (!token) {
         return next(new Error('Authentication error: Token required'));
       }
       
       // Verify JWT token with Clerk's public key
       const decoded = jwt.verify(token, process.env.JWT_VERIFICATION_KEY);
       
       if (!decoded || !decoded.sub) {
         return next(new Error('Authentication error: Invalid token'));
       }
       
       // Store the authenticated user ID on the socket
       socket.userId = decoded.sub;
       next();
       
     } catch (error) {
       console.error('Socket authentication error:', error.message);
       next(new Error('Authentication error: ' + error.message));
     }
   });
   
   // Connection handler now has authenticated userId available
   io.on('connection', async (socket) => {
     console.log('Authenticated client connected:', socket.id, socket.userId);
     
     // Use socket.userId from the authenticated token instead of query parameter
     const userId = socket.userId;
     
     // Rest of connection handler logic
     // ...
   });
   ```

3. Update the client-side connection code in `src/services/gameService.ts`:
   ```typescript
   import { io, Socket } from 'socket.io-client';
   
   connectToSocket: async (userId: string): Promise<Socket> => {
     // Get token from Clerk session
     const token = await getToken();
     
     socket = io(process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'http://localhost:3001', {
       auth: { token },
       autoConnect: true,
       reconnection: true,
     });
     
     // Event listeners setup...
     return socket;
   }
   ```

4. Create a utility function to get the token from Clerk:
   ```typescript
   // src/utils/auth.ts
   import { getAuth } from '@clerk/nextjs/server';
   
   export const getToken = async () => {
     const { getToken } = getAuth();
     return await getToken({ template: 'game_socket' });
   };
   ```

### 2. CORS Configuration

The security audit identified permissive CORS settings in the WebSocket server.

#### Implementation Steps:

1. Update the WebSocket server CORS configuration in `src/server.js`:
   ```javascript
   const io = new Server(server, {
     cors: {
       origin: process.env.NODE_ENV === 'production' 
         ? [process.env.CORS_ORIGIN].filter(Boolean) // Only specific origins in production
         : '*', // Any origin in development
       methods: ['GET', 'POST'],
       credentials: true,
       allowedHeaders: ['Authorization', 'Content-Type']
     }
   });
   ```

2. Add the CORS configuration to your environment variables:
   ```
   CORS_ORIGIN=https://your-domain.com
   ```

### 3. Input Validation

The security audit identified insufficient validation of game actions and move inputs.

#### Implementation Steps:

1. Install validation library:
   ```bash
   npm install joi
   ```

2. Create validation schemas in `src/utils/validateInput.js`:
   ```javascript
   const Joi = require('joi');
   
   // Validation schemas
   const schemas = {
     gameCreation: Joi.object({
       gameType: Joi.string().valid('public', 'private').required(),
       inviteeUsername: Joi.string().when('gameType', {
         is: 'private',
         then: Joi.required(),
         otherwise: Joi.forbidden()
       })
     }),
     
     gameMove: Joi.object({
       gameId: Joi.string().required(),
       from: Joi.string().pattern(/^[a-h][1-8]$/).required(),
       to: Joi.string().pattern(/^[a-h][1-8]$/).required(),
       promotion: Joi.string().valid('q', 'r', 'n', 'b').optional()
     }),
     
     drawOffer: Joi.object({
       gameId: Joi.string().required()
     }),
     
     drawResponse: Joi.object({
       gameId: Joi.string().required(),
       accepted: Joi.boolean().required()
     }),
     
     resignation: Joi.object({
       gameId: Joi.string().required()
     })
   };
   
   // Validate input against schema
   module.exports.validate = (schema, data) => {
     const validationSchema = schemas[schema];
     if (!validationSchema) {
       throw new Error(`Validation schema '${schema}' not found`);
     }
     
     const { error, value } = validationSchema.validate(data);
     if (error) {
       throw new Error(`Validation error: ${error.message}`);
     }
     
     return value;
   };
   ```

3. Apply validation in the WebSocket server:
   ```javascript
   const { validate } = require('./utils/validateInput');
   
   io.on('connection', async (socket) => {
     // Validate game creation
     socket.on('game:created', async (data) => {
       try {
         // Validate input
         const validatedData = validate('gameCreation', data);
         
         // Process with validated data
         // ...
         
       } catch (error) {
         if (error.message.startsWith('Validation error:')) {
           socket.emit('error:validation', {
             message: error.message
           });
         } else {
           socket.emit('error:general', {
             message: 'Failed to create game',
             details: process.env.NODE_ENV === 'production' ? undefined : error.message
           });
         }
       }
     });
     
     // Similarly validate other events
   });
   ```

### 4. WebSocket Message Authorization

The security audit identified that there's no validation that users are authorized to perform actions in games.

#### Implementation Steps:

1. Add authorization checks to the WebSocket server in `src/server.js`:
   ```javascript
   const { db } = require('./database/databaseFactory');
   
   io.on('connection', async (socket) => {
     // Authenticated user ID from the token
     const userId = socket.userId;
     
     // Handle game move
     socket.on('game:updated', async (data) => {
       try {
         // Validate input
         const validatedData = validate('gameMove', data);
         
         // Authorize the action
         const game = await db.getGame(validatedData.gameId);
         if (!game) {
           return socket.emit('error:authorization', {
             message: 'Game not found'
           });
         }
         
         // Check if user is a player in this game
         const isPlayerInGame = game.players.some(p => p.userId === userId);
         if (!isPlayerInGame) {
           return socket.emit('error:authorization', {
             message: 'You are not a player in this game'
           });
         }
         
         // Check if it's the user's turn
         const player = game.players.find(p => p.userId === userId);
         if (player.color !== game.turn) {
           return socket.emit('error:authorization', {
             message: 'It is not your turn'
           });
         }
         
         // Process the move
         // ...
         
       } catch (error) {
         // Error handling
       }
     });
     
     // Apply similar authorization checks to other game actions
   });
   ```

## Addressing Medium Vulnerabilities

### 1. Game ID Predictability

The security audit identified that game IDs are generated using timestamps, making them predictable.

#### Implementation Steps:

1. Update the game ID generation in `src/services/gameService.ts`:
   ```typescript
   import { v4 as uuidv4 } from 'uuid';
   
   // Instead of:
   // const gameId = `game_${Date.now()}`;
   
   // Use:
   const gameId = `game_${uuidv4()}`;
   ```

2. Install the uuid package:
   ```bash
   npm install uuid
   npm install --save-dev @types/uuid
   ```

### 2. Information Disclosure in Error Responses

The security audit identified detailed error messages being returned to clients.

#### Implementation Steps:

1. Update API error responses in `src/app/api/multiplayer/games/route.ts`:
   ```typescript
   try {
     // API logic
   } catch (error) {
     console.error('Error:', error);
     
     // Instead of:
     // return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
     
     // Use:
     return NextResponse.json(
       { error: 'Internal Server Error' }, 
       { status: 500 }
     );
   }
   ```

2. Update WebSocket error responses in `src/server.js`:
   ```javascript
   socket.on('error', (error) => {
     console.error(`Socket error for ${socket.id}:`, error);
     
     socket.emit('error:general', {
       message: 'An unexpected error occurred',
       // Only include details in development
       details: process.env.NODE_ENV === 'production' ? undefined : error.message
     });
   });
   ```

### 3. Rate Limiting

The security audit identified no rate limiting for connections or API calls.

#### Implementation Steps:

1. Install rate limiting package:
   ```bash
   npm install rate-limiter-flexible
   ```

2. Implement rate limiting in the WebSocket server:
   ```javascript
   const { RateLimiterMemory } = require('rate-limiter-flexible');
   
   // Create rate limiters for different actions
   const moveLimiter = new RateLimiterMemory({
     points: parseInt(process.env.MOVE_LIMIT_POINTS, 10) || 10,   // 10 moves
     duration: parseInt(process.env.MOVE_LIMIT_DURATION, 10) || 60,  // per 1 minute
   });
   
   const gameLimiter = new RateLimiterMemory({
     points: parseInt(process.env.GAME_LIMIT_POINTS, 10) || 5,    // 5 games
     duration: parseInt(process.env.GAME_LIMIT_DURATION, 10) || 300,  // per 5 minutes
   });
   
   // Apply rate limiting to socket events
   io.on('connection', async (socket) => {
     // Rate-limited move handler
     socket.on('game:updated', async (data) => {
       try {
         // Check rate limit
         await moveLimiter.consume(socket.userId);
         
         // Process the move
         // ...
         
       } catch (error) {
         if (error.consumedPoints) {
           // This is a rate limit error
           socket.emit('error:rateLimit', {
             message: 'Rate limit exceeded for moves. Please wait before making more moves.',
             retryAfter: error.msBeforeNext / 1000
           });
         } else {
           // Other error
           socket.emit('error:general', {
             message: 'Failed to process move',
             details: process.env.NODE_ENV === 'production' ? undefined : error.message
           });
         }
       }
     });
     
     // Apply rate limiting to other events
   });
   ```

3. Implement rate limiting for API endpoints:
   ```typescript
   // src/app/api/middleware.ts
   import { RateLimiterMemory } from 'rate-limiter-flexible';
   import { NextRequest, NextResponse } from 'next/server';
   
   const apiLimiter = new RateLimiterMemory({
     points: 30, // 30 requests
     duration: 60, // per 1 minute
   });
   
   export async function withRateLimit(
     request: NextRequest,
     handler: (request: NextRequest) => Promise<NextResponse>
   ) {
     try {
       // Use IP address as identifier
       const ip = request.headers.get('x-forwarded-for') || 'unknown';
       
       // Consume points
       await apiLimiter.consume(ip);
       
       // Process the request
       return await handler(request);
       
     } catch (error) {
       if (error.consumedPoints) {
         // Rate limit exceeded
         return NextResponse.json(
           { error: 'Too many requests, please try again later' },
           { 
             status: 429,
             headers: {
               'Retry-After': String(Math.round(error.msBeforeNext / 1000)) || '60'
             }
           }
         );
       }
       
       // Other error
       return NextResponse.json(
         { error: 'Internal Server Error' },
         { status: 500 }
       );
     }
   }
   ```

4. Apply the rate limiting middleware to API routes:
   ```typescript
   // src/app/api/multiplayer/games/route.ts
   import { withRateLimit } from '../../middleware';
   
   export async function GET(request: NextRequest) {
     return withRateLimit(request, async (req) => {
       // Existing handler logic
     });
   }
   
   export async function POST(request: NextRequest) {
     return withRateLimit(request, async (req) => {
       // Existing handler logic
     });
   }
   ```

## Addressing Low Vulnerabilities

### 1. WebSocket URL Configuration

The security audit identified hardcoded WebSocket server URL without TLS.

#### Implementation Steps:

1. Update the WebSocket connection in `src/services/gameService.ts`:
   ```typescript
   socket = io(process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'http://localhost:3001', {
     auth: { token },
     autoConnect: true,
     reconnection: true,
   });
   ```

2. Add environment variables in `.env`:
   ```
   # Development
   NEXT_PUBLIC_WEBSOCKET_URL=http://localhost:3001
   
   # Production
   # NEXT_PUBLIC_WEBSOCKET_URL=wss://your-domain.com
   ```

### 2. Content Security Policy

The security audit identified no Content Security Policy configured.

#### Implementation Steps:

1. Create a middleware for CSP headers in `src/app/middleware.ts`:
   ```typescript
   import { NextResponse } from 'next/server';
   import type { NextRequest } from 'next/server';
   
   export function middleware(request: NextRequest) {
     // Get the response
     const response = NextResponse.next();
     
     // Add security headers
     response.headers.set('Content-Security-Policy', 
       "default-src 'self'; " +
       "script-src 'self' 'unsafe-inline' https://clerk.your-domain.com; " +
       "connect-src 'self' wss://your-domain.com:3001 https://clerk.your-domain.com; " +
       "img-src 'self' data:; " +
       "style-src 'self' 'unsafe-inline';"
     );
     
     response.headers.set('X-Content-Type-Options', 'nosniff');
     response.headers.set('X-Frame-Options', 'SAMEORIGIN');
     response.headers.set('X-XSS-Protection', '1; mode=block');
     
     return response;
   }
   
   export const config = {
     matcher: [
       /*
        * Match all request paths except:
        * 1. /api routes
        * 2. /_next (Next.js internals)
        * 3. /_static (inside /public)
        * 4. all root files inside /public (e.g. /favicon.ico)
        */
       '/((?!api|_next|_static|_vercel|[\\w-]+\\.\\w+).*)',
     ],
   };
   ```

2. Alternatively, configure CSP headers in Nginx:
   ```nginx
   add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' https://clerk.your-domain.com; connect-src 'self' wss://your-domain.com:3001 https://clerk.your-domain.com; img-src 'self' data:; style-src 'self' 'unsafe-inline';" always;
   ```

### 3. CSRF Protection

The security audit identified missing CSRF protection for API endpoints.

#### Implementation Steps:

1. Next.js provides built-in CSRF protection, but for additional security, add a custom CSRF token:
   ```typescript
   // src/utils/csrf.ts
   import { v4 as uuidv4 } from 'uuid';
   
   export const generateCsrfToken = () => {
     return uuidv4();
   };
   
   export const storeCsrfToken = (token: string) => {
     if (typeof window !== 'undefined') {
       sessionStorage.setItem('csrf-token', token);
     }
   };
   
   export const getCsrfToken = () => {
     if (typeof window !== 'undefined') {
       return sessionStorage.getItem('csrf-token');
     }
     return null;
   };
   ```

2. Update API calls to include the CSRF token:
   ```typescript
   // In your component or service
   import { generateCsrfToken, storeCsrfToken, getCsrfToken } from '../utils/csrf';
   
   // Generate and store a token when the app loads
   useEffect(() => {
     const token = generateCsrfToken();
     storeCsrfToken(token);
   }, []);
   
   // Add the token to API requests
   const createGame = async (gameData) => {
     const response = await fetch('/api/multiplayer/games', {
       method: 'POST',
       headers: {
         'Content-Type': 'application/json',
         'X-CSRF-Token': getCsrfToken() || '',
       },
       body: JSON.stringify(gameData),
     });
     return response.json();
   };
   ```

3. Verify the token in API routes:
   ```typescript
   // src/app/api/multiplayer/games/route.ts
   import { NextRequest, NextResponse } from 'next/server';
   
   export async function POST(request: NextRequest) {
     try {
       // Check CSRF token
       const csrfToken = request.headers.get('X-CSRF-Token');
       if (!csrfToken) {
         return NextResponse.json({ error: 'CSRF token missing' }, { status: 403 });
       }
       
       // Continue with request handling
       // ...
     } catch (error) {
       // Error handling
     }
   }
   ```

## Implementing Secure Deployment

### 1. Using Environment Variables for Sensitive Data

Make sure all sensitive configuration is stored in environment variables:

```
# .env.example (create a real .env file for actual values)

# Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
CLERK_JWT_VERIFICATION_KEY=your_clerk_jwt_verification_key

# Database
DATABASE_URL=postgresql://username:password@localhost:5432/chess_db

# WebSocket
WEBSOCKET_PORT=3001
CORS_ORIGIN=https://your-domain.com
NEXT_PUBLIC_WEBSOCKET_URL=wss://your-domain.com

# Rate Limiting
MOVE_LIMIT_POINTS=10
MOVE_LIMIT_DURATION=60
GAME_LIMIT_POINTS=5
GAME_LIMIT_DURATION=300
DRAW_LIMIT_POINTS=3
DRAW_LIMIT_DURATION=60
```

### 2. Using a Process Manager with Secure Configuration

Ensure your PM2 configuration doesn't expose sensitive data:

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'chess-app',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      // Don't include sensitive data here - use .env file instead
    },
    {
      name: 'websocket-server',
      script: 'src/server.js',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      // Don't include sensitive data here - use .env file instead
    }
  ]
};
```

### 3. Regular Security Updates

Set up a schedule for regular security updates:

```bash
# Create a security update script
touch /usr/local/bin/security_updates.sh
chmod +x /usr/local/bin/security_updates.sh
```

Edit the script:

```bash
#!/bin/bash

# Update system packages
apt update
apt upgrade -y

# Update npm packages
cd /var/www/chess-app
npm audit fix

# Restart services
systemctl restart nginx
pm2 restart all
```

Set up a weekly cron job:

```bash
crontab -e
```

Add:

```
0 3 * * 0 /usr/local/bin/security_updates.sh >> /var/log/security_updates.log 2>&1
```

## Next Steps

After implementing these security measures, consider setting up ongoing security monitoring and regular security audits to maintain the security posture of the application.