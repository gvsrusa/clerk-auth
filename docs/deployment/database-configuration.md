# Database Configuration

This document provides detailed instructions for setting up and configuring PostgreSQL for the Multiplayer Chess Application, based on the optimization recommendations.

## Installing PostgreSQL

### On Ubuntu/Debian

```bash
# Update package list
sudo apt update

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Verify installation
sudo systemctl status postgresql
```

### On RedHat/CentOS

```bash
# Install PostgreSQL repository
sudo dnf install -y https://download.postgresql.org/pub/repos/yum/reporpms/EL-8-x86_64/pgdg-redhat-repo-latest.noarch.rpm

# Install PostgreSQL
sudo dnf install -y postgresql14-server postgresql14-contrib

# Initialize database
sudo /usr/pgsql-14/bin/postgresql-14-setup initdb

# Start and enable PostgreSQL service
sudo systemctl enable postgresql-14
sudo systemctl start postgresql-14

# Verify installation
sudo systemctl status postgresql-14
```

## Creating the Database

Connect to PostgreSQL as the postgres user:

```bash
sudo -u postgres psql
```

Execute the following SQL commands:

```sql
-- Create a dedicated user for the application
CREATE USER chess_app WITH PASSWORD 'secure_password_here';

-- Create the database
CREATE DATABASE chess_db OWNER chess_app;

-- Connect to the new database
\c chess_db

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Exit PostgreSQL
\q
```

## Database Schema Setup

The application will automatically set up the required tables when it first runs, but you can manually create them if needed. Connect to the database:

```bash
sudo -u postgres psql -d chess_db
```

Execute the following SQL to create the necessary tables:

```sql
-- Games table
CREATE TABLE IF NOT EXISTS games (
  id VARCHAR(255) PRIMARY KEY,
  status VARCHAR(50) NOT NULL,
  type VARCHAR(50) NOT NULL,
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL,
  turn VARCHAR(10) NOT NULL,
  board TEXT,
  pgn TEXT,
  winner VARCHAR(255),
  draw_offered_by VARCHAR(255),
  invited_user VARCHAR(255)
);

-- Players table
CREATE TABLE IF NOT EXISTS players (
  id SERIAL PRIMARY KEY,
  game_id VARCHAR(255) REFERENCES games(id),
  user_id VARCHAR(255) NOT NULL,
  username VARCHAR(255) NOT NULL,
  color VARCHAR(10) NOT NULL
);

-- Moves table
CREATE TABLE IF NOT EXISTS moves (
  id SERIAL PRIMARY KEY,
  game_id VARCHAR(255) REFERENCES games(id),
  move_data JSONB NOT NULL,
  move_number INT NOT NULL,
  created_at TIMESTAMP NOT NULL
);

-- User connections table
CREATE TABLE IF NOT EXISTS user_connections (
  user_id VARCHAR(255) PRIMARY KEY,
  socket_id VARCHAR(255) NOT NULL,
  last_connected TIMESTAMP NOT NULL
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
CREATE INDEX IF NOT EXISTS idx_games_type ON games(type);
CREATE INDEX IF NOT EXISTS idx_games_created_by ON games(created_by);
CREATE INDEX IF NOT EXISTS idx_players_user_id ON players(user_id);
CREATE INDEX IF NOT EXISTS idx_players_game_id ON players(game_id);
CREATE INDEX IF NOT EXISTS idx_moves_game_id ON moves(game_id);
```

## PostgreSQL Performance Optimization

For optimal performance in production, consider the following configuration changes. Edit the PostgreSQL configuration file:

```bash
# For Ubuntu/Debian
sudo nano /etc/postgresql/14/main/postgresql.conf

# For RedHat/CentOS
sudo nano /var/lib/pgsql/14/data/postgresql.conf
```

Optimize the following settings based on your server resources:

```
# Memory settings
shared_buffers = 1GB                  # 25% of available RAM, up to 8GB
work_mem = 64MB                       # Depends on concurrent connections
maintenance_work_mem = 256MB          # For maintenance operations
effective_cache_size = 3GB            # 75% of available RAM

# Write-Ahead Log (WAL)
wal_buffers = 16MB                    # A reasonable starting value
checkpoint_timeout = 15min            # Increase for less frequent checkpoints
max_wal_size = 1GB                    # Increase for better performance

# Query optimization
random_page_cost = 1.1                # For SSD storage
effective_io_concurrency = 200        # For SSD storage
default_statistics_target = 100       # Increase for better query planning

# Connection settings
max_connections = 100                 # Adjust based on expected load
```

After making changes, restart PostgreSQL:

```bash
# For Ubuntu/Debian
sudo systemctl restart postgresql

# For RedHat/CentOS
sudo systemctl restart postgresql-14
```

## Setting Up Connection Pooling with PgBouncer

For high-traffic environments, set up PgBouncer to manage database connections efficiently:

```bash
# Install PgBouncer
sudo apt install -y pgbouncer

# Configure PgBouncer
sudo nano /etc/pgbouncer/pgbouncer.ini
```

Add the following configuration:

```ini
[databases]
chess_db = host=localhost port=5432 dbname=chess_db

[pgbouncer]
listen_addr = 127.0.0.1
listen_port = 6432
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt
pool_mode = transaction
max_client_conn = 1000
default_pool_size = 50
reserve_pool_size = 25
reserve_pool_timeout = 5.0
```

Create the user list file:

```bash
sudo nano /etc/pgbouncer/userlist.txt
```

Add the database user:

```
"chess_app" "secure_password_here"
```

Set proper permissions and restart PgBouncer:

```bash
sudo chown postgres:postgres /etc/pgbouncer/userlist.txt
sudo chmod 600 /etc/pgbouncer/userlist.txt
sudo systemctl restart pgbouncer
```

Update your application's DATABASE_URL to use PgBouncer:

```
DATABASE_URL=postgresql://chess_app:secure_password_here@localhost:6432/chess_db
```

## Setting Up Backup Strategy

### Automating Daily Backups

Create a backup script:

```bash
sudo nano /usr/local/bin/pg_backup.sh
```

Add the following content:

```bash
#!/bin/bash

# Configuration
BACKUP_DIR="/var/backups/postgres"
DB_NAME="chess_db"
DB_USER="postgres"
DATE=$(date +"%Y-%m-%d")
RETENTION_DAYS=7

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

# Perform backup
pg_dump -U $DB_USER -d $DB_NAME -F c -f $BACKUP_DIR/$DB_NAME-$DATE.backup

# Delete old backups
find $BACKUP_DIR -name "$DB_NAME-*.backup" -mtime +$RETENTION_DAYS -delete
```

Make the script executable:

```bash
sudo chmod +x /usr/local/bin/pg_backup.sh
```

Set up a daily cron job:

```bash
sudo crontab -e
```

Add the following line to schedule backups at 2 AM daily:

```
0 2 * * * /usr/local/bin/pg_backup.sh
```

### Restore Procedure

To restore a backup when needed:

```bash
# Stop the application
pm2 stop all

# Restore the database
pg_restore -U postgres -d chess_db -c /var/backups/postgres/chess_db-YYYY-MM-DD.backup

# Start the application
pm2 start all
```

## Securing PostgreSQL

### Restricting Network Access

Edit the PostgreSQL configuration:

```bash
# For Ubuntu/Debian
sudo nano /etc/postgresql/14/main/pg_hba.conf

# For RedHat/CentOS
sudo nano /var/lib/pgsql/14/data/pg_hba.conf
```

Ensure only local connections are allowed:

```
# TYPE  DATABASE        USER            ADDRESS                 METHOD
local   all             postgres                                peer
local   all             chess_app                               md5
host    all             chess_app       127.0.0.1/32            md5
host    all             chess_app       ::1/128                 md5
```

Edit the PostgreSQL network configuration:

```bash
# For Ubuntu/Debian
sudo nano /etc/postgresql/14/main/postgresql.conf

# For RedHat/CentOS
sudo nano /var/lib/pgsql/14/data/postgresql.conf
```

Set the listen address to localhost:

```
listen_addresses = 'localhost'
```

Restart PostgreSQL after making changes:

```bash
# For Ubuntu/Debian
sudo systemctl restart postgresql

# For RedHat/CentOS
sudo systemctl restart postgresql-14
```

## Next Steps

After completing the database configuration, proceed to [Production Configuration](production-configuration.md) to configure the application for production use.