# Update Workflows

This document outlines the recommended procedures for updating the Multiplayer Chess Application. Following these workflows will help ensure updates are applied safely and with minimal disruption to users.

## Update Categories

Updates to the Multiplayer Chess Application fall into several categories:

1. **Application Code Updates**: Changes to the Next.js application code
2. **Dependency Updates**: Updates to Node.js packages and dependencies
3. **Server Software Updates**: Updates to Node.js, npm, and other server software
4. **Database Schema Updates**: Changes to the PostgreSQL database schema
5. **Configuration Updates**: Changes to environment variables and configuration files

## General Update Workflow

The general workflow for all updates follows these steps:

1. **Plan**: Identify what needs to be updated and why
2. **Test**: Test the update in a development or staging environment
3. **Backup**: Create backups before applying updates to production
4. **Update**: Apply the update to the production environment
5. **Verify**: Verify the update was successful
6. **Rollback**: If necessary, roll back to the previous state

## Application Code Update Workflow

### 1. Prepare Update

Clone the repository and create a feature branch:

```bash
# Clone the repository (if not already done)
git clone https://github.com/your-username/chess-app.git
cd chess-app

# Make sure you have the latest changes
git checkout main
git pull origin main

# Create a feature branch
git checkout -b feature/your-feature-name
```

### 2. Make and Test Changes

Make your changes and test them locally:

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test
```

### 3. Create a Pull Request

Push your changes and create a pull request:

```bash
git add .
git commit -m "Description of changes"
git push origin feature/your-feature-name
```

Create a pull request on GitHub and have it reviewed.

### 4. Deploy to Staging

Once the pull request is approved, deploy to a staging environment:

```bash
# On the staging server
cd /var/www/chess-app-staging

# Pull the feature branch
git fetch
git checkout feature/your-feature-name

# Install dependencies
npm install

# Build the application
npm run build

# Restart the application
pm2 restart all
```

### 5. Test in Staging

Thoroughly test the application in the staging environment:

- Test all affected functionality
- Run automated tests
- Perform manual testing
- Check for regressions

### 6. Deploy to Production

After successful testing, merge to main and deploy to production:

```bash
# Merge PR on GitHub

# On the production server
cd /var/www/chess-app

# Create a backup before updating
./scripts/backup_before_update.sh

# Pull the latest changes
git pull origin main

# Install dependencies
npm install

# Build the application
npm run build

# Restart the application with zero downtime
pm2 reload all
```

### 7. Verify Production Deployment

Verify the update was successful in production:

- Check logs for errors: `pm2 logs`
- Monitor application performance
- Verify key functionality
- Watch error tracking tools (Sentry, etc.)

### 8. Rollback if Necessary

If issues are detected, roll back to the previous version:

```bash
# On the production server
cd /var/www/chess-app

# Revert to the previous commit
git reset --hard HEAD~1

# Rebuild the application
npm install
npm run build

# Restart the application
pm2 reload all
```

## Dependency Updates Workflow

### 1. Check for Outdated Dependencies

Regularly check for outdated dependencies:

```bash
npm outdated
```

### 2. Create Update Plan

Create an update plan based on the outdated dependencies:

- Prioritize security updates
- Group minor updates together
- Handle major updates individually with careful testing

### 3. Update Dependencies in Development

Update dependencies in development:

```bash
# For minor updates and patches
npm update

# For major updates or specific packages
npm install package-name@latest
```

### 4. Test Updated Dependencies

Test the application with updated dependencies:

```bash
# Run tests
npm test

# Start development server and test functionality
npm run dev
```

### 5. Create a Pull Request

Create a pull request specifically for dependency updates:

```bash
git checkout -b update/dependencies-yyyy-mm-dd
git add package.json package-lock.json
git commit -m "Update dependencies (yyyy-mm-dd)"
git push origin update/dependencies-yyyy-mm-dd
```

### 6. Deploy to Staging and Production

Follow the same staging and production deployment steps as outlined in the Application Code Update Workflow.

## Server Software Updates

### 1. Inventory Current Versions

Take inventory of current software versions:

```bash
node --version
npm --version
pm2 --version
```

### 2. Research Updates

Research available updates, focusing on:
- Security patches
- Bug fixes
- New features relevant to your application

### 3. Test in Development Environment

Test the updates in a development environment first:

```bash
# Update Node.js (using nvm)
nvm install 18.x  # Replace with target version
nvm use 18.x

# Update npm
npm install -g npm@latest

# Update PM2
npm install -g pm2@latest
```

### 4. Schedule Maintenance Window

Schedule a maintenance window for the production update, notifying users in advance.

### 5. Backup Before Update

Create a full backup before updating:

```bash
# Run comprehensive backup
./scripts/comprehensive_backup.sh
```

### 6. Apply Updates in Production

Apply the updates during the maintenance window:

```bash
# Update Node.js
nvm install 18.x  # Replace with target version
nvm use 18.x
nvm alias default 18.x

# Update npm
npm install -g npm@latest

# Update PM2
npm install -g pm2@latest

# Restart application
pm2 update
pm2 reload all
```

### 7. Verify Updates

Verify the updates were successful:

```bash
node --version
npm --version
pm2 --version

# Check application status
pm2 status
```

## Database Schema Updates

### 1. Create Migration Scripts

Create database migration scripts for schema changes:

```sql
-- migrations/YYYY-MM-DD_description.sql
-- Up migration
BEGIN;

-- Your schema changes here
ALTER TABLE games ADD COLUMN new_column VARCHAR(255);

COMMIT;
```

Also create a rollback script:

```sql
-- migrations/YYYY-MM-DD_description_rollback.sql
-- Down migration
BEGIN;

-- Rollback schema changes
ALTER TABLE games DROP COLUMN new_column;

COMMIT;
```

### 2. Test Migrations in Development

Test the migration scripts in a development environment:

```bash
# Apply migration
psql -U postgres -d chess_db_dev -f migrations/YYYY-MM-DD_description.sql

# Test application with new schema
npm test

# If needed, test rollback
psql -U postgres -d chess_db_dev -f migrations/YYYY-MM-DD_description_rollback.sql
```

### 3. Apply Migrations in Staging

Apply and test the migrations in staging:

```bash
# Apply migration
psql -U postgres -d chess_db_staging -f migrations/YYYY-MM-DD_description.sql

# Test application with new schema
```

### 4. Apply Migrations in Production

Apply the migrations in production during a maintenance window:

```bash
# Backup database before migration
pg_dump -U postgres -d chess_db -F c -f /var/backups/postgres/pre_migration_$(date +"%Y-%m-%d").backup

# Apply migration
psql -U postgres -d chess_db -f migrations/YYYY-MM-DD_description.sql
```

### 5. Verify Schema Changes

Verify the schema changes were applied correctly:

```bash
# Check table structure
psql -U postgres -d chess_db -c "\d games"

# Verify application functionality
```

### 6. Rollback if Necessary

If issues are detected, roll back to the previous schema:

```bash
# Apply rollback script
psql -U postgres -d chess_db -f migrations/YYYY-MM-DD_description_rollback.sql
```

## Configuration Updates

### 1. Document Changes

Document the configuration changes:

```
# Configuration Change Log
Date: YYYY-MM-DD
Change: Added NEW_CONFIG_VARIABLE
Reason: Required for new feature X
Default: default_value
```

### 2. Update Development and Staging

Update the configuration in development and staging:

```bash
# Edit .env file
nano .env
```

Add or modify the required configuration variables.

### 3. Test with New Configuration

Test the application with the new configuration:

```bash
# Restart the application
pm2 restart all

# Test functionality affected by the configuration change
```

### 4. Update Production Configuration

After successful testing, update the production configuration:

```bash
# Backup current configuration
cp /var/www/chess-app/.env /var/backups/config/env_$(date +"%Y-%m-%d").backup

# Edit .env file
nano /var/www/chess-app/.env
```

Add or modify the required configuration variables.

### 5. Apply Configuration Changes

Apply the configuration changes:

```bash
# Restart the application
pm2 restart all
```

### 6. Verify Configuration Update

Verify the configuration update was successful:

```bash
# Check if the application is using the new configuration
# This depends on your application's logging
pm2 logs --lines 100
```

## Zero-Downtime Updates

For critical production environments, implement zero-downtime updates:

### 1. Set Up Multiple Application Instances

Configure PM2 to run multiple instances of the application:

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'chess-app',
      script: 'npm',
      args: 'start',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    }
  ]
};
```

### 2. Use Reload Instead of Restart

Use PM2's reload feature to restart instances one at a time:

```bash
pm2 reload all
```

### 3. Use Blue-Green Deployment for Major Updates

For major updates, use a blue-green deployment approach:

1. Set up an identical "green" environment with the new version
2. Test the green environment thoroughly
3. Switch traffic from the "blue" (current) to the "green" (new) environment
4. If issues arise, switch traffic back to the blue environment

## Scheduled Maintenance

For updates that require downtime or pose significant risk:

1. **Schedule Maintenance Window**: Choose a time with minimal user impact
2. **Notify Users**: Provide advance notice (at least 24 hours)
3. **Prepare Update**: Have all changes ready to minimize downtime
4. **Perform Backup**: Create a full backup before maintenance
5. **Apply Updates**: Perform all necessary updates
6. **Test Thoroughly**: Verify all functionality before ending maintenance
7. **Notify Users**: Inform users when maintenance is complete

## Update Logging

Maintain a changelog of all updates:

```bash
# Create an update log entry
cat >> /var/log/chess-app/updates.log << EOF
Date: $(date)
Type: [Application Code | Dependencies | Server Software | Database | Configuration]
Description: Brief description of the update
Performed by: Your Name
Details:
- Changed X to Y
- Added feature Z
- Fixed bug A

Result: [Successful | Failed - Rolled Back]
EOF
```

## Security Updates

Security updates should be given the highest priority:

1. **Set Up Security Alerts**: Configure npm audit, GitHub security alerts, etc.
2. **Regularly Check for Vulnerabilities**:
   ```bash
   npm audit
   ```
3. **Quickly Address Critical Vulnerabilities**:
   ```bash
   npm audit fix
   ```
4. **For Complex Fixes**: Create a dedicated security update branch
5. **Fast-Track Security Updates**: Expedite the review and deployment process

## Next Steps

After implementing update workflows, proceed to [Troubleshooting Common Issues](troubleshooting.md) to learn how to diagnose and resolve problems that may occur during operation.