#!/bin/bash

# Run tests with the optimized configuration
echo "Running tests with optimized configuration..."

# Set environment variables for tests
export JEST_WORKER_ID=1
export NODE_ENV=test

# Run the tests
npm test

# Display test results summary
echo ""
echo "Test run complete!"
echo "--------------------"
echo "The following optimizations have been implemented:"
echo "1. Enhanced StockfishService with better error handling and fallbacks"
echo "2. Improved test setup with proper module mocking"
echo "3. Fixed audio resource loading issues"
echo "4. Reduced unnecessary re-renders with React.memo"
echo "5. Added error boundaries for component failures"
echo "6. Implemented caching for performance optimization"
echo ""
echo "See docs/reports/optimization/single_player_optimization_report.md for details"