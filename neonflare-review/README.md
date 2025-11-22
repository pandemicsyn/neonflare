# Neonflare Review

Multi-agent code review tool that orchestrates AI agents (codex, Claude, kilocode) for collaborative code reviews.

## Status

✅ **Phase 1-3 Complete** - Core functionality ready for use!

### Completed
- ✅ Go module setup with Makefile
- ✅ Cobra CLI with full flag support
- ✅ Configuration system (.neonflare.yaml + CLI overrides)
- ✅ Agent interface with proper CLI wrappers
- ✅ Review orchestrator with parallel execution
- ✅ Prompt templating system
- ✅ Git input handler (diff, staged, commits)
- ✅ Stdin input handler for piping
- ✅ Markdown output writer with metadata
- ✅ Comprehensive test suite (79.4% coverage)

### In Progress
- 🔨 Bubbletea UI (Phase 4) - currently using console output

### Requirements

To use neonflare-review, you need at least **3 of the following AI CLI tools** installed:

- **[Codex CLI](https://codex.so)** - Uses `codex exec` for non-interactive execution
- **[Claude Code](https://claude.ai/code)** - Uses `claude --print` for one-shot mode
- **[Kilocode](https://kilocode.com)** - Uses `kilocode --auto` for autonomous mode

Configure the CLI paths in `.neonflare.yaml` if they're not in your PATH.

## Quick Start

```bash
# Build with Makefile
make build

# Or use go directly
go build -o bin/neonflare-review

# View help
./bin/neonflare-review --help

# Review git repo (random agent selection)
./bin/neonflare-review /path/to/repo

# Review with specific agents
./bin/neonflare-review --agents=codex,claude,kilocode /path/to/repo

# Review staged changes only
./bin/neonflare-review --staged /path/to/repo

# Review specific commit
./bin/neonflare-review --commit=abc123 /path/to/repo

# Review from stdin (pipe git diff)
git diff | ./bin/neonflare-review --stdin

# Override models
./bin/neonflare-review --model-claude=claude-opus-4 /path/to/repo

# Add custom prompt instructions
./bin/neonflare-review --prompt="Focus on security issues" /path/to/repo
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

## Output

Reviews are saved as markdown files in `.neonflare-reviews/` (configurable):

```
.neonflare-reviews/
├── 2024-01-15_143022_codex_review.md      # First reviewer
├── 2024-01-15_143022_claude_review.md     # Second reviewer
└── 2024-01-15_143022_aggregate.md         # Final synthesized review
```

Each file includes:
- Agent name and model used
- Timestamp and duration
- Repository metadata (branch, commit, remote)
- Full review content

## Development

```bash
# Run all checks (fmt, vet, test, build)
make all

# Run tests with coverage
make test
make test-coverage

# Build binary
make build

# Clean artifacts
make clean
```

See [plan.md](plan.md) for detailed implementation roadmap.

## License

MIT
