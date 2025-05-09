# Monitoring Recommendations

This document provides recommendations for monitoring the Multiplayer Chess Application to ensure optimal performance, detect issues early, and maintain system health.

## Monitoring Categories

Effective monitoring of the Multiplayer Chess Application should cover the following key areas:

1. **Server Health Monitoring**
2. **Application Performance Monitoring**
3. **Database Monitoring**
4. **WebSocket Server Monitoring**
5. **Error and Exception Monitoring**
6. **Security Monitoring**
7. **User Experience Monitoring**

## Server Health Monitoring

### Key Metrics to Monitor

- **CPU Usage**: Monitor for sustained high CPU usage (>80%)
- **Memory Usage**: Watch for memory leaks or insufficient allocation
- **Disk Space**: Ensure sufficient space for logs, backups, and application data
- **Network Traffic**: Track inbound/outbound traffic and identify unusual patterns
- **System Load Average**: Measure overall system load

### Recommended Tools

- **Node Exporter with Prometheus**: Collects server metrics
- **Grafana**: Visualizes metrics from Prometheus
- **Netdata**: Lightweight real-time monitoring
- **Datadog**: Commercial solution with comprehensive monitoring

### Implementation Example

Set up Prometheus and Node Exporter:

```bash
# Install Node Exporter
wget https://github.com/prometheus/node_exporter/releases/download/v1.3.1/node_exporter-1.3.1.linux-amd64.tar.gz
tar xvfz node_exporter-1.3.1.linux-amd64.tar.gz
cd node_exporter-1.3.1.linux-amd64
sudo cp node_exporter /usr/local/bin
sudo useradd -rs /bin/false node_exporter

# Create systemd service for Node Exporter
sudo tee /etc/systemd/system/node_exporter.service > /dev/null <<EOF
[Unit]
Description=Node Exporter
After=network.target

[Service]
User=node_exporter
Group=node_exporter
Type=simple
ExecStart=/usr/local/bin/node_exporter

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl start node_exporter
sudo systemctl enable node_exporter
```

## Application Performance Monitoring

### Key Metrics to Monitor

- **Request Rate**: Number of API requests per minute
- **Response Time**: Average and percentile (p95, p99) response times
- **Error Rate**: Percentage of requests resulting in errors
- **Active Users**: Number of concurrent users
- **Active Games**: Number of active multiplayer games
- **WebSocket Connections**: Number of active WebSocket connections

### Recommended Tools

- **Prometheus with Express Middleware**: For metrics collection in Node.js
- **PM2 Plus**: Monitoring for PM2-managed processes
- **New Relic**: Commercial APM solution
- **Datadog APM**: Commercial APM with distributed tracing

### Implementation Example

Set up Express middleware for Prometheus metrics:

```bash
npm install prom-client express-prom-bundle
```

Add to your Next.js API routes:

```typescript
// src/middleware/metrics.ts
import { NextApiRequest, NextApiResponse } from 'next';
import promBundle from 'express-prom-bundle';

const metricsMiddleware = promBundle({
  includeMethod: true,
  includePath: true,
  promClient: {
    collectDefaultMetrics: {
      timeout: 5000
    }
  }
});

export default function metrics(req: NextApiRequest, res: NextApiResponse, next: Function) {
  return metricsMiddleware(req, res, next);
}
```

## Database Monitoring

### Key Metrics to Monitor

- **Query Performance**: Slow query count and execution times
- **Connection Pool Usage**: Current connections vs. maximum connections
- **Transaction Rate**: Transactions per second
- **Cache Hit Ratio**: Effectiveness of the database cache
- **Index Usage**: Ensuring indexes are being used effectively
- **Database Size**: Growth of the database over time

### Recommended Tools

- **pgMonitor**: Comprehensive PostgreSQL monitoring solution
- **pgHero**: PostgreSQL performance dashboard
- **PostgreSQL Exporter for Prometheus**: Metrics collection for PostgreSQL
- **pgBadger**: PostgreSQL performance analyzer

### Implementation Example

Set up PostgreSQL Exporter for Prometheus:

```bash
# Install PostgreSQL Exporter
wget https://github.com/prometheus-community/postgres_exporter/releases/download/v0.10.0/postgres_exporter-0.10.0.linux-amd64.tar.gz
tar xvfz postgres_exporter-0.10.0.linux-amd64.tar.gz
cd postgres_exporter-0.10.0.linux-amd64
sudo cp postgres_exporter /usr/local/bin

# Create service account
sudo useradd -rs /bin/false postgres_exporter

# Create systemd service
sudo tee /etc/systemd/system/postgres_exporter.service > /dev/null <<EOF
[Unit]
Description=PostgreSQL Exporter
After=network.target

[Service]
User=postgres_exporter
Group=postgres_exporter
Type=simple
Environment="DATA_SOURCE_NAME=postgresql://postgres:password@localhost:5432/postgres?sslmode=disable"
ExecStart=/usr/local/bin/postgres_exporter

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl start postgres_exporter
sudo systemctl enable postgres_exporter
```

## WebSocket Server Monitoring

### Key Metrics to Monitor

- **Active Connections**: Number of connected clients
- **Message Rate**: Messages sent/received per second
- **Connection Errors**: Failed connection attempts
- **Latency**: Time taken for messages to be delivered
- **Reconnection Rate**: Frequency of client reconnections

### Recommended Tools

- **Socket.IO Admin UI**: Monitoring dashboard for Socket.IO
- **Custom Metrics with Prometheus**: Track Socket.IO metrics
- **Grafana Dashboard**: Visualize WebSocket metrics

### Implementation Example

Add custom metrics to the WebSocket server:

```javascript
// src/server.js
const { Counter, Gauge } = require('prom-client');

// Set up Prometheus metrics
const activeConnections = new Gauge({
  name: 'socketio_active_connections',
  help: 'Number of active WebSocket connections'
});

const messagesSent = new Counter({
  name: 'socketio_messages_sent',
  help: 'Number of WebSocket messages sent'
});

const messagesReceived = new Counter({
  name: 'socketio_messages_received',
  help: 'Number of WebSocket messages received'
});

// Update metrics in Socket.IO events
io.on('connection', (socket) => {
  activeConnections.inc();
  
  socket.on('disconnect', () => {
    activeConnections.dec();
  });
  
  // Track messages received
  socket.onAny((eventName) => {
    messagesReceived.inc();
  });
  
  // Wrap emit to track messages sent
  const originalEmit = socket.emit;
  socket.emit = function(event, ...args) {
    messagesSent.inc();
    return originalEmit.apply(this, [event, ...args]);
  };
});
```

## Error and Exception Monitoring

### Key Metrics to Monitor

- **Error Rate**: Total errors per minute
- **New Errors**: First-time occurrences of errors
- **Error Distribution**: Types of errors and their frequencies
- **User Impact**: Number of users affected by errors

### Recommended Tools

- **Sentry**: Exception and error tracking
- **Rollbar**: Error tracking and alerting
- **Log Aggregation**: ELK Stack (Elasticsearch, Logstash, Kibana)
- **Loki**: Log aggregation designed to work with Grafana

### Implementation Example

Set up Sentry for error tracking:

```bash
npm install @sentry/nextjs
```

Initialize Sentry in your Next.js application:

```javascript
// sentry.server.config.js
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: "https://your-sentry-dsn.ingest.sentry.io/project",
  tracesSampleRate: 1.0,
  environment: process.env.NODE_ENV,
});
```

## Security Monitoring

### Key Metrics to Monitor

- **Failed Authentication Attempts**: Track potential brute force attacks
- **Rate Limiting Breaches**: Identify potential DoS attempts
- **JWT Token Usage**: Monitor for suspicious token activity
- **API Usage Patterns**: Detect unusual API usage patterns
- **Dependency Vulnerabilities**: Track vulnerable dependencies

### Recommended Tools

- **OSSEC**: Host-based intrusion detection
- **Wazuh**: Security monitoring platform
- **Fail2Ban**: Prevents brute force attacks
- **Snyk**: Dependency vulnerability scanning
- **npm audit**: Built-in package vulnerability scanner

### Implementation Example

Set up npm audit as part of your CI/CD pipeline:

```bash
# Add to your deployment script
npm audit --production

# Or with automatic fixes for non-breaking changes
npm audit fix --production
```

## User Experience Monitoring

### Key Metrics to Monitor

- **Page Load Time**: Time to fully load the application
- **Time to Interactive**: When users can interact with the game
- **WebSocket Connection Time**: How long it takes to establish WebSocket connection
- **Game Move Latency**: Time between move submission and opponent receiving it
- **Error Rate by User**: Track errors experienced by specific users

### Recommended Tools

- **Lighthouse**: Performance testing
- **WebPageTest**: Advanced performance testing
- **Datadog RUM**: Real User Monitoring
- **New Relic Browser**: Frontend monitoring

### Implementation Example

Set up regular Lighthouse tests:

```bash
# Install Lighthouse CLI
npm install -g lighthouse

# Run Lighthouse tests
lighthouse https://your-chess-app.com --output-path=./lighthouse-report.html --view
```

## Alerting System

### Critical Alerts

Set up alerts for critical issues that require immediate attention:

- Server CPU usage > 90% for more than 5 minutes
- Memory usage > 90% for more than 5 minutes
- Database connection failures
- Error rate > 1% of requests
- WebSocket server disconnections
- API endpoints returning 5xx errors

### Warning Alerts

Set up alerts for issues that need attention but aren't immediately critical:

- Server CPU usage > 70% for more than 15 minutes
- Memory usage > 80% for more than 15 minutes
- Disk usage > 80%
- Slow database queries (> 1 second)
- Increased latency in API responses
- Connection pool approaching maximum

### Informational Alerts

Set up notifications for general information:

- Backup completion status
- Successful deployment of new versions
- Security updates availability
- Unusual traffic patterns

### Recommended Alert Channels

- **Email**: For non-urgent issues
- **SMS/Push Notifications**: For critical issues requiring immediate attention
- **Slack/Teams Integration**: For team-wide visibility
- **PagerDuty**: For on-call rotations

## Monitoring Dashboard

Create a centralized monitoring dashboard that gives a complete picture of the application's health:

1. **Server Status Panel**: CPU, memory, disk usage
2. **Application Performance Panel**: Request rate, response time, error rate
3. **Database Performance Panel**: Query performance, connection pool usage
4. **WebSocket Status Panel**: Active connections, message rate
5. **User Activity Panel**: Active users, games being played
6. **Recent Errors Panel**: Latest errors with impact assessment
7. **Security Panel**: Failed login attempts, rate limit breaches

### Dashboard Implementation

Use Grafana to create a comprehensive dashboard:

```bash
# Install Grafana
sudo apt-get install -y apt-transport-https software-properties-common
sudo add-apt-repository "deb https://packages.grafana.com/oss/deb stable main"
wget -q -O - https://packages.grafana.com/gpg.key | sudo apt-key add -
sudo apt-get update
sudo apt-get install grafana

# Start and enable Grafana
sudo systemctl start grafana-server
sudo systemctl enable grafana-server
```

## Next Steps

After setting up monitoring, proceed to [Backup Procedures](backup.md) to ensure your data is protected and recoverable in case of failures.