# Troubleshooting Common Issues

This document provides guidance for diagnosing and resolving common issues that may occur with the Multiplayer Chess Application. Issues are categorized by component for easier navigation.

## Web Application Issues

### Application Not Loading

**Symptoms:**
- Blank page when accessing the application URL
- Browser console shows 500 or 502 errors

**Potential Causes and Solutions:**

1. **Next.js Server Not Running**
   ```bash
   # Check if the process is running
   pm2 status
   
   # If not running, start it
   pm2 start ecosystem.config.js
   
   # Check logs for errors
   pm2 logs chess-app
   ```

2. **Build Issues**
   ```bash
   # Check if the build directory exists
   ls -la /var/www/chess-app/.next
   
   # If missing or incomplete, rebuild the application
   cd /var/www/chess-app
   npm run build
   ```

3. **Nginx Configuration Issues**
   ```bash
   # Check Nginx configuration
   sudo nginx -t
   
   # Check if Nginx is running
   sudo systemctl status nginx
   
   # Restart Nginx if needed
   sudo systemctl restart nginx
   ```

### Authentication Problems

**Symptoms:**
- Unable to log in
- "Authentication error" messages
- Clerk widget not loading

**Potential Causes and Solutions:**

1. **Clerk Configuration Issues**
   - Verify Clerk environment variables in `.env`
   - Check if Clerk services are operational at https://status.clerk.dev
   - Review Clerk logs in the Clerk Dashboard

2. **JWT Verification Issues**
   ```bash
   # Check if JWT verification key is set
   grep JWT_VERIFICATION_KEY /var/www/chess-app/.env
   
   # If missing or incorrect, update it
   nano /var/www/chess-app/.env
   ```

3. **CORS Issues**
   - Check browser console for CORS errors
   - Verify that Clerk domain is properly configured in CORS settings
   - Update CORS configuration if needed:
   ```bash
   nano /etc/nginx/sites-available/chess-app
   # Add/update CORS headers
   sudo systemctl restart nginx
   ```

### Page Loading Slowly

**Symptoms:**
- Long loading times
- Timeout errors

**Potential Causes and Solutions:**

1. **Server Resource Issues**
   ```bash
   # Check CPU and memory usage
   top
   free -m
   
   # If resources are constrained, consider:
   # - Upgrading server resources
   # - Optimizing application settings
   # - Reducing other processes on the server
   ```

2. **Database Performance Issues**
   ```bash
   # Check PostgreSQL performance
   sudo -u postgres psql -c "SELECT * FROM pg_stat_activity;"
   
   # Look for slow queries
   sudo -u postgres psql -c "SELECT * FROM pg_stat_activity WHERE state = 'active' AND now() - query_start > '5 seconds'::interval;"
   ```

3. **Network Issues**
   ```bash
   # Check network connectivity
   ping -c 4 google.com
   
   # Test application endpoint latency
   curl -w "Connect: %{time_connect}s\nStart Transfer: %{time_starttransfer}s\nTotal: %{time_total}s\n" -o /dev/null -s https://your-domain.com
   ```

## WebSocket Server Issues

### Connection Problems

**Symptoms:**
- "Unable to connect to game server" error
- Game features not working
- Multiplayer functionality breaks

**Potential Causes and Solutions:**

1. **WebSocket Server Not Running**
   ```bash
   # Check if WebSocket server is running
   pm2 status
   
   # Start if not running
   pm2 start ecosystem.config.js
   
   # Check logs for errors
   pm2 logs websocket-server
   ```

2. **WebSocket URL Configuration Issues**
   - Check WebSocket URL in the client-side configuration
   - Verify that NEXT_PUBLIC_WEBSOCKET_URL is correctly set in `.env`
   - For secure WebSockets (wss://), verify SSL certificates

3. **Firewall or Network Issues**
   ```bash
   # Check if WebSocket port is open
   sudo netstat -tulpn | grep 3001
   
   # Check firewall settings
   sudo ufw status
   
   # Allow WebSocket port if needed
   sudo ufw allow 3001/tcp
   ```

### Socket Authentication Failures

**Symptoms:**
- Authentication error in WebSocket connection
- Users can't join or create games
- WebSocket connection disconnects immediately

**Potential Causes and Solutions:**

1. **JWT Verification Issues**
   ```bash
   # Verify JWT verification key in WebSocket server
   grep JWT_VERIFICATION_KEY /var/www/chess-app/.env
   
   # Check WebSocket server logs for auth errors
   pm2 logs websocket-server
   ```

2. **Token Generation Problems**
   - Check that Clerk is properly configured to provide JWT tokens
   - Verify that the client is correctly sending the token
   - Test token generation in a development environment

3. **Clock Synchronization Issues**
   ```bash
   # Check server time
   date
   
   # Sync server clock
   sudo apt install -y ntp
   sudo systemctl start ntp
   sudo systemctl enable ntp
   ```

### Game State Synchronization Issues

**Symptoms:**
- Game state differs between players
- Moves not properly synchronized
- "Illegal move" errors when moves should be valid

**Potential Causes and Solutions:**

1. **WebSocket Message Handling Issues**
   - Check WebSocket server logs for errors during message processing
   - Verify that all clients are on the same version of the application
   - Clear browser cache on client devices

2. **Race Conditions**
   ```bash
   # Check for error patterns in logs
   pm2 logs websocket-server | grep "race condition"
   
   # Restart WebSocket server
   pm2 restart websocket-server
   ```

3. **Database Connectivity Issues**
   ```bash
   # Check if WebSocket server can connect to database
   pg_isready -h localhost -d chess_db
   
   # Check database connection errors in logs
   pm2 logs websocket-server | grep "database"
   ```

## Database Issues

### Connection Failures

**Symptoms:**
- Application errors related to database operations
- "Cannot connect to database" errors
- Game state not saving

**Potential Causes and Solutions:**

1. **PostgreSQL Service Not Running**
   ```bash
   # Check if PostgreSQL is running
   sudo systemctl status postgresql
   
   # Start PostgreSQL if not running
   sudo systemctl start postgresql
   sudo systemctl enable postgresql
   ```

2. **Database Credentials Issues**
   - Verify database connection string in `.env`
   - Check that the database user exists and has proper permissions
   ```bash
   sudo -u postgres psql -c "\du"
   ```

3. **Database Resource Issues**
   ```bash
   # Check PostgreSQL resource usage
   sudo -u postgres psql -c "SELECT * FROM pg_stat_activity;"
   
   # Check PostgreSQL logs
   sudo tail -n 100 /var/log/postgresql/postgresql-14-main.log
   ```

### Data Integrity Issues

**Symptoms:**
- Inconsistent game state
- Missing game data
- Database constraint errors

**Potential Causes and Solutions:**

1. **Transaction Failures**
   ```bash
   # Check PostgreSQL logs for transaction errors
   sudo grep "ERROR" /var/log/postgresql/postgresql-14-main.log
   
   # Run database consistency check
   sudo -u postgres vacuumdb --analyze --verbose chess_db
   ```

2. **Database Corruption**
   ```bash
   # Check for database corruption
   sudo -u postgres pg_amcheck -d chess_db
   
   # If corruption is found, restore from backup
   # See backup.md for restore procedures
   ```

3. **Disk Space Issues**
   ```bash
   # Check disk space
   df -h
   
   # Check PostgreSQL data directory size
   sudo du -sh /var/lib/postgresql/14/main
   
   # Clear unnecessary files if needed
   sudo -u postgres psql -c "VACUUM FULL;"
   ```

## Performance Issues

### Slow Game Creation or Joining

**Symptoms:**
- Long delays when creating games
- Timeouts when joining games
- Poor responsiveness in the lobby

**Potential Causes and Solutions:**

1. **Database Connection Pool Exhaustion**
   ```bash
   # Check active connections
   sudo -u postgres psql -c "SELECT count(*) FROM pg_stat_activity;"
   
   # If approaching max_connections, increase pool size
   # Edit postgresql.conf
   sudo nano /etc/postgresql/14/main/postgresql.conf
   # Increase max_connections
   
   # Restart PostgreSQL
   sudo systemctl restart postgresql
   ```

2. **WebSocket Server Overload**
   ```bash
   # Check WebSocket server resource usage
   pm2 monit
   
   # Scale WebSocket server horizontally if needed
   # Edit ecosystem.config.js to add more instances
   pm2 reload ecosystem.config.js
   ```

3. **Rate Limiting Too Restrictive**
   - Check rate limiting settings in environment variables
   - Adjust rate limits if they're too restrictive for typical usage

### High CPU or Memory Usage

**Symptoms:**
- Server becoming unresponsive
- Slow application performance
- Out of memory errors

**Potential Causes and Solutions:**

1. **Memory Leaks**
   ```bash
   # Monitor memory usage over time
   pm2 monit
   
   # Check for patterns of increasing memory usage
   # If detected, restart the affected service
   pm2 restart chess-app
   ```

2. **Inefficient Database Queries**
   ```bash
   # Identify slow queries
   sudo -u postgres psql -c "SELECT query, calls, total_time, mean_time FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"
   
   # Analyze and optimize problematic queries
   # Add indexes if needed
   sudo -u postgres psql -d chess_db -c "CREATE INDEX idx_name ON table_name (column_name);"
   ```

3. **Too Many Concurrent Connections**
   ```bash
   # Check number of connections
   sudo -u postgres psql -c "SELECT count(*) FROM pg_stat_activity;"
   
   # Implement connection pooling with PgBouncer if not already done
   # See database-configuration.md for PgBouncer setup
   ```

## Security Issues

### Suspicious Activities

**Symptoms:**
- Unusual access patterns
- Unexpected authentication attempts
- Suspicious game creation or moves

**Potential Causes and Solutions:**

1. **Brute Force Attacks**
   ```bash
   # Check authentication logs
   grep "auth" /var/log/nginx/access.log
   
   # Implement or adjust rate limiting
   # Update Nginx configuration with rate limiting directives
   sudo nano /etc/nginx/sites-available/chess-app
   sudo systemctl restart nginx
   ```

2. **Unauthorized Access Attempts**
   ```bash
   # Check for 403/401 errors
   grep " 403 " /var/log/nginx/access.log
   grep " 401 " /var/log/nginx/access.log
   
   # If patterns suggest attacks, block IPs
   sudo ufw deny from attacker_ip to any
   ```

3. **Unfixed Vulnerabilities**
   ```bash
   # Check for security vulnerabilities
   npm audit
   
   # Fix vulnerabilities
   npm audit fix
   
   # For more complex issues, upgrade affected packages
   npm update package-name
   ```

### Data Exposure

**Symptoms:**
- Sensitive information appearing in logs
- User data visible to unauthorized users
- Configuration details exposed

**Potential Causes and Solutions:**

1. **Logging Sensitive Information**
   ```bash
   # Check logs for sensitive data
   grep -i "password\|token\|key" /var/log/chess-app/*.log
   
   # Update logging configuration to redact sensitive data
   nano /var/www/chess-app/logger.js
   ```

2. **Missing Access Controls**
   - Review WebSocket event handlers for proper authorization checks
   - Ensure API endpoints properly validate permissions
   - Test access controls with different user roles

3. **Environment Variable Exposure**
   ```bash
   # Check if environment variables are exposed
   grep "env" /var/www/chess-app/.next/server/pages/api/*.js
   
   # Ensure sensitive environment variables are not sent to the client
   # Review code for improper exposure of env vars
   ```

## Common Specific Errors

### "WebSocket connection failed"

**Potential Causes and Solutions:**

1. **Incorrect WebSocket URL**
   - Check NEXT_PUBLIC_WEBSOCKET_URL in `.env`
   - Ensure protocol matches (ws:// for HTTP, wss:// for HTTPS)

2. **WebSocket Server Down**
   ```bash
   pm2 status
   pm2 restart websocket-server
   ```

3. **Network/Firewall Issues**
   - Check for firewall rules blocking WebSocket port
   - Verify proxy settings if behind a proxy

### "Game not found" Error

**Potential Causes and Solutions:**

1. **Database Connectivity Issue**
   ```bash
   # Check database connection
   pg_isready -h localhost -d chess_db
   ```

2. **Game Record Deleted or Expired**
   ```bash
   # Check for the game in database
   sudo -u postgres psql -d chess_db -c "SELECT * FROM games WHERE id = 'game_id';"
   ```

3. **Cache Inconsistency**
   - Restart WebSocket server to clear memory cache
   ```bash
   pm2 restart websocket-server
   ```

### "Move validation failed" Error

**Potential Causes and Solutions:**

1. **Chess Logic Bugs**
   - Check the implemented chess rules
   - Verify game state consistency between players

2. **Game State Corruption**
   ```bash
   # Check game state in database
   sudo -u postgres psql -d chess_db -c "SELECT board FROM games WHERE id = 'game_id';"
   
   # Reset game state if necessary (requires application code changes)
   ```

3. **Client-Server Version Mismatch**
   - Ensure all clients and server are running the same version
   - Check for pending application updates

## Diagnostic Commands Reference

Here's a quick reference of useful diagnostic commands for troubleshooting:

### Application Status

```bash
# Check application status
pm2 status

# View application logs
pm2 logs chess-app

# Monitor application resources
pm2 monit
```

### WebSocket Server

```bash
# Check WebSocket server status
pm2 status websocket-server

# View WebSocket server logs
pm2 logs websocket-server

# Test WebSocket connectivity
curl --include \
     --no-buffer \
     --header "Connection: Upgrade" \
     --header "Upgrade: websocket" \
     --header "Host: your-domain.com:3001" \
     --header "Origin: https://your-domain.com" \
     --header "Sec-WebSocket-Key: SGVsbG8sIHdvcmxkIQ==" \
     --header "Sec-WebSocket-Version: 13" \
     https://your-domain.com:3001/
```

### Database

```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Connect to database
sudo -u postgres psql -d chess_db

# Check active database connections
sudo -u postgres psql -c "SELECT count(*) FROM pg_stat_activity;"

# Identify long-running queries
sudo -u postgres psql -c "SELECT pid, now() - pg_stat_activity.query_start AS duration, query FROM pg_stat_activity WHERE state != 'idle' AND now() - pg_stat_activity.query_start > interval '30 seconds' ORDER BY duration DESC;"
```

### Nginx Web Server

```bash
# Check Nginx configuration
sudo nginx -t

# Check Nginx status
sudo systemctl status nginx

# View access logs
sudo tail -f /var/log/nginx/access.log

# View error logs
sudo tail -f /var/log/nginx/error.log
```

### Server Resources

```bash
# Check disk space
df -h

# Check memory usage
free -m

# Check CPU usage
top

# Check system load
uptime
```

## Troubleshooting Checklist

When encountering issues, follow this general troubleshooting checklist:

1. **Check System Status**
   - Is the server running and accessible?
   - Are all required services running (Nginx, PostgreSQL, Node.js)?

2. **Check Application Logs**
   - Look for errors in the application logs
   - Check WebSocket server logs
   - Review Nginx access and error logs

3. **Check Database Status**
   - Is PostgreSQL running?
   - Can the application connect to the database?
   - Are there any slow or failing queries?

4. **Check Network Connectivity**
   - Is the server reachable from client devices?
   - Are the required ports open?
   - Are there any firewall or network issues?

5. **Check Resource Usage**
   - Is the server running out of disk space?
   - Is there enough memory available?
   - Is the CPU usage too high?

6. **Check for Recent Changes**
   - Was there a recent update?
   - Were there configuration changes?
   - Were there database schema changes?

7. **Check Security Concerns**
   - Are there authentication issues?
   - Are there suspicious activities?
   - Are there any known vulnerabilities?

## Requesting Support

If you need additional support, gather the following information before contacting support:

1. **Error Messages**: Exact error messages and stack traces
2. **Logs**: Relevant logs from the application, WebSocket server, and Nginx
3. **Environment**: Version information for Node.js, npm, PostgreSQL, etc.
4. **Steps to Reproduce**: Clear steps to reproduce the issue
5. **Recent Changes**: Details of any recent updates or configuration changes
6. **Attempted Solutions**: What troubleshooting steps you've already tried

## Next Steps

After troubleshooting and resolving issues, consider:

1. **Documenting the Issue**: Update this troubleshooting guide with new insights
2. **Implementing Preventive Measures**: Address root causes to prevent recurrence
3. **Enhancing Monitoring**: Add monitoring for detected failure points
4. **Reviewing Update Procedures**: If the issue was caused by an update, review update procedures