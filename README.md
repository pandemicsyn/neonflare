# Neonflare

[![CI](https://github.com/your-username/neonflare/actions/workflows/ci.yml/badge.svg)](https://github.com/your-username/neonflare/actions/workflows/ci.yml)

Neonflare is a TypeScript package that provides OpenTelemetry instrumentation for MCP (Model Context Protocol) servers via [Rotel](https://github.com/streamfold/rotel). It offers comprehensive observability into MCP server usage patterns, performance metrics, and user interactions.

## Features

- 🚀 **Easy Integration**: Simple API to instrument existing MCP servers
- 📊 **OpenTelemetry Native**: Built on OpenTelemetry standards with Rotel integration
- 🔍 **Context Injection**: Automatic context parameter injection for intent tracking
- 🛡️ **Data Protection**: Built-in sensitive data redaction
- 🎯 **Session Tracking**: Comprehensive session and user identification
- ⚡ **High Performance**: Non-blocking instrumentation with async processing

## Installation

```bash
# Using npm
npm install @neonflare/mcp

# Using yarn
yarn add @neonflare/mcp

# Using pnpm
pnpm add @neonflare/mcp
```