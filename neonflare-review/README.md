# Neonflare Review

Multi-agent code review tool that orchestrates AI agents (codex, Claude, kilocode) for collaborative code reviews.

## Status

🚧 **Work in Progress** - Phase 1 (Core Infrastructure) completed

### Completed
- ✅ Go module setup
- ✅ Cobra CLI structure
- ✅ Configuration system (.neonflare.yaml)
- ✅ Agent interface and base implementations
- ✅ Review orchestrator skeleton
- ✅ Prompt templating system

### In Progress
- 🔨 Agent CLI wrappers (Phase 2)
- 🔨 Input handlers (Phase 3)
- 🔨 Bubbletea UI (Phase 4)

## Quick Start

```bash
# Build
go build -o neonflare-review

# View help
./neonflare-review --help

# Example usage (once implemented)
./neonflare-review /path/to/repo
./neonflare-review --auto --agents=codex,claude,kilocode /path/to/repo
```

## Configuration

Copy `.neonflare.yaml.example` to `.neonflare.yaml` and customize:

```yaml
agents:
  codex:
    enabled: true
    model: "gpt-4"
    timeout: 300s
    cli_path: "codex"

  # ... see .neonflare.yaml.example for full config
```

## How It Works

1. Two agents are randomly selected to perform independent code reviews
2. Each reviewer analyzes the code in parallel
3. A third agent aggregates and synthesizes the two reviews
4. Final review is displayed and saved as markdown

## Project Structure

```
neonflare-review/
├── cmd/              # Cobra commands
├── internal/
│   ├── agents/       # Agent implementations
│   ├── config/       # Configuration management
│   ├── review/       # Review orchestration
│   ├── input/        # Input handlers (git, stdin)
│   ├── ui/           # Bubbletea UI components
│   └── output/       # Output formatting
└── prompts/          # Prompt templates
```

## Development

See [plan.md](plan.md) for detailed implementation roadmap.

## License

MIT
