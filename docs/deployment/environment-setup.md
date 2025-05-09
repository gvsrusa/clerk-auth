# Environment Setup

This document provides detailed instructions for setting up the server environment for the Multiplayer Chess Application.

## Server Preparation

### Installing Essential Packages (Ubuntu/Debian)

```bash
# Update package list
sudo apt update

# Install essential packages
sudo apt install -y git curl wget build-essential
```

### Setting Up Node.js and npm

```bash
# Install Node.js and npm using NodeSource
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version  # Should be v18.x or later
npm --version   # Should be v9.x or later

# Install pm2 for process management
npm install -g pm2
```

## Cloning the Repository

```bash
# Create application directory
mkdir -p /var/www/chess-app
cd /var/www/chess-app

# Clone the repository
git clone https://github.com/your-username/chess-app.git .

# Install dependencies
npm install
```

## Setting Up Environment Variables

Create a `.env` file in the root directory of the project:

```bash
touch .env
```

Edit the `.env` file with the following variables:

```
# General
NODE_ENV=production
PORT=3000

# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
CLERK_JWT_VERIFICATION_KEY=your_clerk_jwt_verification_key

# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/chess_db
DATABASE_TYPE=postgres

# WebSocket Server
WEBSOCKET_PORT=3001
CORS_ORIGIN=https://your-domain.com
JWT_VERIFICATION_KEY=your_clerk_jwt_verification_key
```

Replace the placeholder values with your actual configuration.

## SSL Certificate Setup (Using Let's Encrypt)

```bash
# Install Certbot
sudo apt install -y certbot

# If using Nginx
sudo apt install -y python3-certbot-nginx

# If using Apache
sudo apt install -y python3-certbot-apache

# Generate certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Certificate will auto-renew via a cron job created by Certbot
```

## Configuring a Reverse Proxy

### Nginx Configuration

Create a new Nginx site configuration:

```bash
sudo nano /etc/nginx/sites-available/chess-app
```

Add the following configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name your-domain.com www.your-domain.com;
    
    # SSL configuration (managed by Certbot)
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' https://clerk.your-domain.com; connect-src 'self' wss://your-domain.com:3001 https://clerk.your-domain.com; img-src 'self' data:; style-src 'self' 'unsafe-inline';" always;
    
    # Next.js application
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # WebSocket server
    location /socket.io/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Enable the site and restart Nginx:

```bash
sudo ln -s /etc/nginx/sites-available/chess-app /etc/nginx/sites-enabled/
sudo nginx -t  # Test configuration
sudo systemctl restart nginx
```

## Setting Up pm2 for Process Management

Create a pm2 ecosystem file:

```bash
touch ecosystem.config.js
```

Add the following content:

```javascript
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
      instances: 'max',
      exec_mode: 'cluster',
      watch: false,
      max_memory_restart: '512M'
    },
    {
      name: 'websocket-server',
      script: 'src/server.js',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        CORS_ORIGIN: 'https://your-domain.com',
        JWT_VERIFICATION_KEY: 'your_clerk_jwt_verification_key'
      },
      watch: false,
      max_memory_restart: '512M'
    }
  ]
};
```

## Setting Up Firewall

Configure UFW (Uncomplicated Firewall):

```bash
# Allow SSH
sudo ufw allow ssh

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# If you're not using a reverse proxy, also allow your app ports
# sudo ufw allow 3000/tcp  # Next.js
# sudo ufw allow 3001/tcp  # WebSocket server

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

## Next Steps

After completing the environment setup, proceed to [Database Configuration](database-configuration.md) to set up and configure PostgreSQL for the application.