# Backup Procedures

This document outlines the recommended backup procedures for the Multiplayer Chess Application to ensure data integrity and recoverability in case of failure.

## Backup Strategy Overview

An effective backup strategy for the Multiplayer Chess Application includes:

1. **Database Backups**: PostgreSQL database backups
2. **File System Backups**: Application code and configuration files
3. **Environment Configuration Backups**: Environment variables and configuration settings
4. **Backup Testing**: Regular verification of backup integrity and restore procedures
5. **Off-site Storage**: External storage of backups for disaster recovery

## Database Backup Procedures

### Daily Full Backups

Perform a complete database backup daily using PostgreSQL's pg_dump utility:

```bash
#!/bin/bash
# Name: daily_db_backup.sh

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

# Log backup completion
echo "Database backup completed at $(date)" >> $BACKUP_DIR/backup.log
```

Set up a daily cron job to execute this script:

```bash
sudo crontab -e
```

Add the following line to schedule backups at 2 AM daily:

```
0 2 * * * /path/to/daily_db_backup.sh
```

### Hourly WAL Archiving (For High-Value Deployments)

For deployments where data loss must be minimized, set up Write-Ahead Log (WAL) archiving for point-in-time recovery:

1. Configure PostgreSQL for WAL archiving by editing `postgresql.conf`:

```
wal_level = replica
archive_mode = on
archive_command = 'cp %p /var/lib/postgresql/wal_archive/%f'
```

2. Create the WAL archive directory:

```bash
sudo mkdir -p /var/lib/postgresql/wal_archive
sudo chown postgres:postgres /var/lib/postgresql/wal_archive
```

3. Restart PostgreSQL:

```bash
sudo systemctl restart postgresql
```

4. Create a script to backup WAL archives periodically:

```bash
#!/bin/bash
# Name: wal_archive_backup.sh

ARCHIVE_DIR="/var/lib/postgresql/wal_archive"
BACKUP_DIR="/var/backups/postgres/wal"
DATE=$(date +"%Y-%m-%d-%H")

# Create backup directory
mkdir -p $BACKUP_DIR

# Archive WAL files
tar -czf $BACKUP_DIR/wal-$DATE.tar.gz $ARCHIVE_DIR

# Keep only 24 hours of archives
find $BACKUP_DIR -name "wal-*.tar.gz" -mtime +1 -delete
```

5. Schedule this script to run hourly:

```bash
0 * * * * /path/to/wal_archive_backup.sh
```

## File System Backup Procedures

### Application Code Backup

While the application code should be version-controlled in a Git repository, it's still good practice to back up the deployed code:

```bash
#!/bin/bash
# Name: app_backup.sh

APP_DIR="/var/www/chess-app"
BACKUP_DIR="/var/backups/app"
DATE=$(date +"%Y-%m-%d")
RETENTION_DAYS=30

# Create backup directory
mkdir -p $BACKUP_DIR

# Create backup excluding node_modules and other unnecessary files
tar --exclude="node_modules" --exclude=".next" --exclude="logs" -czf $BACKUP_DIR/chess-app-$DATE.tar.gz $APP_DIR

# Delete old backups
find $BACKUP_DIR -name "chess-app-*.tar.gz" -mtime +$RETENTION_DAYS -delete
```

Schedule this script to run weekly:

```
0 3 * * 0 /path/to/app_backup.sh
```

### Configuration Backup

Back up important configuration files separately:

```bash
#!/bin/bash
# Name: config_backup.sh

CONFIG_SOURCES=(
  "/var/www/chess-app/.env"
  "/etc/nginx/sites-available/chess-app"
  "/etc/systemd/system/chess-app.service"
  "/etc/logrotate.d/chess-app"
)
BACKUP_DIR="/var/backups/config"
DATE=$(date +"%Y-%m-%d")

# Create backup directory
mkdir -p $BACKUP_DIR

# Create a new directory for today's backup
mkdir -p $BACKUP_DIR/$DATE

# Copy each config file
for CONFIG in "${CONFIG_SOURCES[@]}"; do
  FILENAME=$(basename $CONFIG)
  cp $CONFIG $BACKUP_DIR/$DATE/$FILENAME
done

# Create a compressed archive
tar -czf $BACKUP_DIR/config-$DATE.tar.gz -C $BACKUP_DIR $DATE

# Remove the temporary directory
rm -rf $BACKUP_DIR/$DATE

# Keep only the last 90 days of backups
find $BACKUP_DIR -name "config-*.tar.gz" -mtime +90 -delete
```

Schedule this to run daily:

```
0 4 * * * /path/to/config_backup.sh
```

## Environment Configuration Backup

Create a secure backup of environment variables and sensitive configuration:

```bash
#!/bin/bash
# Name: env_backup.sh

# Source directory
ENV_FILE="/var/www/chess-app/.env"

# Backup directory
BACKUP_DIR="/var/backups/env"
DATE=$(date +"%Y-%m-%d")

# Create backup directory
mkdir -p $BACKUP_DIR

# Encrypt and backup the environment file
gpg --symmetric --cipher-algo AES256 --output $BACKUP_DIR/env-$DATE.gpg $ENV_FILE

# Keep only the last 30 days of backups
find $BACKUP_DIR -name "env-*.gpg" -mtime +30 -delete
```

Schedule this to run weekly:

```
0 4 * * 0 /path/to/env_backup.sh
```

Make sure to store the encryption password securely and separately from the backups.

## Comprehensive Backup Script

For convenience, create a comprehensive backup script that performs all necessary backups:

```bash
#!/bin/bash
# Name: comprehensive_backup.sh

echo "Starting comprehensive backup at $(date)"

# Database backup
echo "Backing up database..."
/path/to/daily_db_backup.sh

# Application code backup
echo "Backing up application code..."
/path/to/app_backup.sh

# Configuration backup
echo "Backing up configuration files..."
/path/to/config_backup.sh

# Environment variables backup
echo "Backing up environment variables..."
/path/to/env_backup.sh

echo "Comprehensive backup completed at $(date)"
```

## Off-site Backup Storage

Ensure backups are stored off-site to protect against data center or server failures:

### Using AWS S3 for Off-site Storage

1. Install the AWS CLI:

```bash
apt-get install -y awscli
```

2. Configure AWS credentials:

```bash
aws configure
```

3. Create a script to sync backups to S3:

```bash
#!/bin/bash
# Name: offsite_backup.sh

# Local backup directory
LOCAL_BACKUP_DIR="/var/backups"

# S3 bucket name
S3_BUCKET="chess-app-backups"

# Sync backups to S3
aws s3 sync $LOCAL_BACKUP_DIR s3://$S3_BUCKET/$(hostname)/

# Log completion
echo "Off-site backup to S3 completed at $(date)" >> /var/log/offsite-backup.log
```

4. Schedule this to run daily:

```
0 5 * * * /path/to/offsite_backup.sh
```

## Backup Testing Procedures

Regularly test your backup and restore procedures to ensure they work when needed:

### Database Restore Testing

Create a script to test database restores:

```bash
#!/bin/bash
# Name: test_db_restore.sh

# Configuration
BACKUP_DIR="/var/backups/postgres"
DB_NAME="chess_db"
TEST_DB_NAME="chess_db_test_restore"
DB_USER="postgres"

# Find the latest backup
LATEST_BACKUP=$(find $BACKUP_DIR -name "$DB_NAME-*.backup" -type f -printf '%T@ %p\n' | sort -n | tail -1 | cut -f2- -d" ")

# Create test database
PGPASSWORD=$DB_PASSWORD psql -U $DB_USER -c "DROP DATABASE IF EXISTS $TEST_DB_NAME;"
PGPASSWORD=$DB_PASSWORD psql -U $DB_USER -c "CREATE DATABASE $TEST_DB_NAME;"

# Restore backup to test database
pg_restore -U $DB_USER -d $TEST_DB_NAME $LATEST_BACKUP

# Verify restore
TABLES_COUNT=$(PGPASSWORD=$DB_PASSWORD psql -U $DB_USER -d $TEST_DB_NAME -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';")

echo "Restore test completed. Found $TABLES_COUNT tables in restored database."

# Clean up
PGPASSWORD=$DB_PASSWORD psql -U $DB_USER -c "DROP DATABASE $TEST_DB_NAME;"

# Log results
echo "Database restore test completed at $(date) - Found $TABLES_COUNT tables" >> /var/log/backup-tests.log
```

Schedule this to run monthly:

```
0 3 1 * * /path/to/test_db_restore.sh
```

### Application Restore Testing

Create a script to test application restore:

```bash
#!/bin/bash
# Name: test_app_restore.sh

# Configuration
BACKUP_DIR="/var/backups/app"
TEST_RESTORE_DIR="/tmp/chess-app-restore-test"

# Find the latest backup
LATEST_BACKUP=$(find $BACKUP_DIR -name "chess-app-*.tar.gz" -type f -printf '%T@ %p\n' | sort -n | tail -1 | cut -f2- -d" ")

# Clean up previous test
rm -rf $TEST_RESTORE_DIR
mkdir -p $TEST_RESTORE_DIR

# Extract backup
tar -xzf $LATEST_BACKUP -C $TEST_RESTORE_DIR

# Verify extraction
FILE_COUNT=$(find $TEST_RESTORE_DIR -type f | wc -l)

echo "Application restore test completed. Found $FILE_COUNT files in restored application."

# Clean up
rm -rf $TEST_RESTORE_DIR

# Log results
echo "Application restore test completed at $(date) - Found $FILE_COUNT files" >> /var/log/backup-tests.log
```

Schedule this to run monthly:

```
0 4 1 * * /path/to/test_app_restore.sh
```

## Backup Monitoring

Monitor backup operations to ensure they're completing successfully:

### Backup Status Dashboard

Create a simple web dashboard to show backup status:

```bash
#!/bin/bash
# Name: generate_backup_status.sh

HTML_OUTPUT="/var/www/html/backup-status.html"

echo "<html><head><title>Backup Status</title></head><body>" > $HTML_OUTPUT
echo "<h1>Backup Status</h1>" >> $HTML_OUTPUT
echo "<p>Generated at $(date)</p>" >> $HTML_OUTPUT

echo "<h2>Database Backups</h2>" >> $HTML_OUTPUT
echo "<pre>" >> $HTML_OUTPUT
find /var/backups/postgres -name "chess_db-*.backup" -type f -printf '%TY-%Tm-%Td %TH:%TM - %p - %s bytes\n' | sort -r | head -10 >> $HTML_OUTPUT
echo "</pre>" >> $HTML_OUTPUT

echo "<h2>Application Backups</h2>" >> $HTML_OUTPUT
echo "<pre>" >> $HTML_OUTPUT
find /var/backups/app -name "chess-app-*.tar.gz" -type f -printf '%TY-%Tm-%Td %TH:%TM - %p - %s bytes\n' | sort -r | head -10 >> $HTML_OUTPUT
echo "</pre>" >> $HTML_OUTPUT

echo "<h2>Configuration Backups</h2>" >> $HTML_OUTPUT
echo "<pre>" >> $HTML_OUTPUT
find /var/backups/config -name "config-*.tar.gz" -type f -printf '%TY-%Tm-%Td %TH:%TM - %p - %s bytes\n' | sort -r | head -10 >> $HTML_OUTPUT
echo "</pre>" >> $HTML_OUTPUT

echo "<h2>Backup Tests</h2>" >> $HTML_OUTPUT
echo "<pre>" >> $HTML_OUTPUT
tail -20 /var/log/backup-tests.log >> $HTML_OUTPUT
echo "</pre>" >> $HTML_OUTPUT

echo "</body></html>" >> $HTML_OUTPUT
```

Schedule this to run hourly:

```
0 * * * * /path/to/generate_backup_status.sh
```

## Disaster Recovery Plan

Document the full disaster recovery process:

1. **Server Failure**:
   - Provision a new server with the same specifications
   - Install all required software as per the [Prerequisites](../deployment/prerequisites.md) document
   - Restore configuration files from backup
   - Restore environment variables from backup
   - Restore application code from backup or deploy from Git repository
   - Restore database from the latest backup
   - Test application functionality

2. **Database Corruption**:
   - Stop the application to prevent further writes
   - Drop and recreate the database
   - Restore from the latest backup
   - For point-in-time recovery (if WAL archiving is enabled):
     - Restore the base backup
     - Apply WAL archives up to the desired recovery point
   - Restart the application

3. **Data Center Outage**:
   - Provision resources in a new data center
   - Restore all components from off-site backups
   - Update DNS records to point to the new infrastructure
   - Verify functionality in the new environment

## Next Steps

After implementing backup procedures, proceed to [Update Workflows](updates.md) to learn how to safely update the application.