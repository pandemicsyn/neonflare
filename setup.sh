# Create the package directory structure
mkdir -p packages/mcp/src/{core,instrumentation,telemetry,enrichment,config,types,utils}
mkdir -p packages/mcp/{tests,docs}

# Initialize the MCP package
cd packages/mcp

# Create package.json
cat > package.json << 'EOF'
{
  "name": "@neonflare/mcp",
  "version": "0.1.0",
  "description": "MCP server instrumentation with OpenTelemetry via rotel",
  "main": "./dist/index.js",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "files": [
    "dist",
    "README.md"
  ],
  "scripts": {
    "build": "tsup src/index.ts --format cjs,esm --dts --clean",
    "dev": "tsup src/index.ts --format esm --watch",
    "test": "jest",
    "lint": "eslint src --ext .ts",
    "typecheck": "tsc --noEmit"
  },
  "keywords": [
    "mcp",
    "model-context-protocol",
    "opentelemetry",
    "rotel",
    "observability",
    "tracing",
    "instrumentation"
  ],
  "peerDependencies": {
    "@modelcontextprotocol/sdk": "^1.18.0"
  },
  "dependencies": {
    "@streamfold/rotel": "latest",
    "@opentelemetry/api": "^1.9.0",
    "@opentelemetry/sdk-trace-node": "^1.25.0",
    "@opentelemetry/exporter-trace-otlp-grpc": "^0.52.0",
    "@opentelemetry/semantic-conventions": "^1.25.0",
    "@opentelemetry/resources": "^1.25.0"
  },
  "devDependencies": {
    "@modelcontextprotocol/sdk": "^1.18.0",
    "tsup": "^8.0.0",
    "jest": "^29.0.0",
    "@types/jest": "^29.0.0"
  }
}
EOF

# Create TypeScript config
cat > tsconfig.json << 'EOF'
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
EOF

# Create a basic index.ts to start with
cat > src/index.ts << 'EOF'
export { trackmcp } from './core/tracker';

// Temporary placeholder
export const trackmcp = (server: any, config: any) => {
  console.log('Neonflare MCP instrumentation initialized');
  return server;
};
EOF

# Create README
cat > README.md << 'EOF'
# @neonflare/mcp

MCP server instrumentation with OpenTelemetry via rotel.

## Installation
