# Production Configuration

This document provides instructions for configuring the Multiplayer Chess Application for production use, including optimizing performance, implementing caching, and setting up monitoring.

## Building the Application for Production

### Creating a Production Build

Run the following commands to create a production build of the Next.js application:

```bash
# Navigate to the application directory
cd /var/www/chess-app

# Build the application
npm run build
```

The build process will create an optimized version of the application in the `.next` directory.

## Application Configuration

### Database Adapter Configuration

First, make sure you've installed the necessary dependencies:

```bash
npm install pg node-cache rate-limiter-flexible joi jsonwebtoken
npm install --save-dev @types/pg @types/node-cache @types/jsonwebtoken
```

The application should be configured to use the PostgreSQL database adapter in production. Edit the `.env` file:

```
DATABASE_TYPE=postgres
DATABASE_URL=postgresql://chess_app:secure_password_here@localhost:5432/chess_db
# Or if using PgBouncer:
# DATABASE_URL=postgresql://chess_app:secure_password_here@localhost:6432/chess_db
```

### WebSocket Server Configuration

Configure the WebSocket server for production by editing the `.env` file:

```
CORS_ORIGIN=https://your-domain.com
JWT_VERIFICATION_KEY=your_clerk_jwt_verification_key
```

### Server Start Command Configuration

Update the `package.json` file to ensure the correct server start commands:

```json
"scripts": {
  "dev": "next dev --turbopack",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "test": "jest",
  "socket-server": "node src/server.js",
  "dev-all": "concurrently \"npm run dev\" \"npm run socket-server\"",
  "start-all": "pm2 start ecosystem.config.js"
}
```

## Performance Optimizations

### Implementing Caching

The application uses node-cache for in-memory caching. The caching is configured in the application code, but you can adjust the TTL (time-to-live) values by setting environment variables:

```
CACHE_DEFAULT_TTL=300
CACHE_CHECK_PERIOD=60
```

### Optimizing WebSocket Communication

To optimize WebSocket communication, the server is configured to:

1. Use optimized message payloads
2. Implement reconnection support
3. Use rooms for targeted message distribution

These optimizations are built into the codebase and don't require additional configuration.

### Static Asset Optimization

Next.js automatically optimizes static assets during the build process. For additional optimization:

1. Enable compression in your web server:

For Nginx:
```nginx
# Add to your server block
gzip on;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
gzip_comp_level 6;
gzip_min_length 1000;
```

2. Set up appropriate caching headers:

```nginx
# Add to your Nginx server block
location /_next/static/ {
    expires 30d;
    add_header Cache-Control "public, max-age=2592000, immutable";
}

location /static/ {
    expires 30d;
    add_header Cache-Control "public, max-age=2592000";
}
```

## Rate Limiting Configuration

Configure rate limiting for the application to prevent abuse by setting these environment variables:

```
# Rate limiting for moves
MOVE_LIMIT_POINTS=10
MOVE_LIMIT_DURATION=60

# Rate limiting for game creation
GAME_LIMIT_POINTS=5
GAME_LIMIT_DURATION=300

# Rate limiting for draw offers
DRAW_LIMIT_POINTS=3
DRAW_LIMIT_DURATION=60
```

## Setting Up Monitoring and Logging

### Application Logging

Configure application logging by setting up a logging directory:

```bash
# Create logs directory
mkdir -p /var/www/chess-app/logs

# Set correct permissions
chown -R www-data:www-data /var/www/chess-app/logs
```

Set up log rotation:

```bash
sudo nano /etc/logrotate.d/chess-app
```

Add the following configuration:

```
/var/www/chess-app/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        service nginx reload > /dev/null 2>/dev/null || true
    endscript
}
```

### Setting Up Error Monitoring with Sentry

First, install Sentry:

```bash
npm install @sentry/nextjs
```

Create a Sentry configuration file:

```bash
touch sentry.server.config.js
touch sentry.client.config.js
```

Edit `sentry.server.config.js`:

```javascript
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: 'your-sentry-dsn',
  tracesSampleRate: 1.0,
  environment: process.env.NODE_ENV,
});
```

Edit `sentry.client.config.js`:

```javascript
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: 'your-sentry-dsn',
  tracesSampleRate: 1.0,
  environment: process.env.NODE_ENV,
  integrations: [
    new Sentry.BrowserTracing(),
  ],
});
```

### Server Monitoring with PM2

PM2 provides basic monitoring capabilities. To access the monitoring dashboard:

```bash
pm2 monit
```

For more advanced monitoring, set up PM2 Plus:

```bash
pm2 plus
```

Follow the instructions to create an account and link your server.

### Database Monitoring

Set up PgHero for PostgreSQL monitoring:

```bash
# Install PgHero
gem install pghero

# Create configuration
mkdir -p /etc/pghero
touch /etc/pghero/config.yml
```

Edit the configuration file:

```yaml
databases:
  primary:
    url: postgres://postgres:password@localhost:5432/chess_db
```

Set up a systemd service for PgHero:

```bash
sudo nano /etc/systemd/system/pghero.service
```

Add the following:

```
[Unit]
Description=PgHero PostgreSQL monitoring
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/etc/pghero
ExecStart=/usr/local/bin/pghero
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
sudo systemctl enable pghero
sudo systemctl start pghero
```

## Setting Up Health Checks

Create a health check endpoint in your Next.js application:

```javascript
// src/app/api/health/route.ts
import { NextResponse } from 'next/server';
import { db } from '../../../database/databaseFactory';

export async function GET() {
  try {
    // Check database connection
    await db.ping();
    
    return NextResponse.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      services: {
        database: 'up',
        application: 'up'
      }
    });
  } catch (error) {
    return NextResponse.json({ 
      status: 'error', 
      message: 'Health check failed',
      services: {
        database: 'down',
        application: 'up'
      }
    }, { status: 500 });
  }
}
```

Add the health check endpoint to your monitoring service or set up a simple cron job to check it regularly:

```bash
sudo crontab -e
```

Add:

```
*/5 * * * * curl -s https://your-domain.com/api/health > /dev/null || echo "Health check failed" | mail -s "Chess App Health Check Failed" admin@your-domain.com
```

## WebSocket Server High Availability

For high availability, configure multiple WebSocket server instances with a load balancer.

Update your Nginx configuration to load balance between multiple WebSocket servers:

```nginx
upstream websocket_servers {
    server localhost:3001;
    server localhost:3002;
    server localhost:3003;
    # Add more servers as needed
}

server {
    # ... other configuration ...
    
    location /socket.io/ {
        proxy_pass http://websocket_servers;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Update your PM2 ecosystem file to run multiple WebSocket servers:

```javascript
module.exports = {
  apps: [
    // ... Next.js app configuration ...
    {
      name: 'websocket-server-1',
      script: 'src/server.js',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        CORS_ORIGIN: 'https://your-domain.com',
        JWT_VERIFICATION_KEY: 'your_clerk_jwt_verification_key'
      },
    },
    {
      name: 'websocket-server-2',
      script: 'src/server.js',
      env: {
        NODE_ENV: 'production',
        PORT: 3002,
        CORS_ORIGIN: 'https://your-domain.com',
        JWT_VERIFICATION_KEY: 'your_clerk_jwt_verification_key'
      },
    },
    {
      name: 'websocket-server-3',
      script: 'src/server.js',
      env: {
        NODE_ENV: 'production',
        PORT: 3003,
        CORS_ORIGIN: 'https://your-domain.com',
        JWT_VERIFICATION_KEY: 'your_clerk_jwt_verification_key'
      },
    }
  ]
};
```

## Next Steps

After completing the production configuration, proceed to [Security Implementation](security-implementation.md) to implement security measures identified in the security audit.