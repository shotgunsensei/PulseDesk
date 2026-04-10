#!/bin/bash
echo "Pushing database schema..."
npx drizzle-kit push --force 2>&1 || echo "Schema push warning (non-fatal)"
echo "Starting server..."
NODE_ENV=production exec node dist/index.cjs
