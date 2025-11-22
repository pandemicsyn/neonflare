# Neonflare Review - Multi-Agent Code Review CLI

## Overview
A Go-based CLI tool that orchestrates multiple AI agents (codex, Claude, kilocode) to perform collaborative code reviews. Two randomly selected agents perform initial reviews, and a third agent aggregates and vets the results.

## Project Structure

```
neonflare-review/
├── go.mod                          # Dedicated Go module
├── go.sum
├── main.go                         # Entry point
├── cmd/
│   ├── root.go                     # Cobra root command
│   ├── review.go                   # Review command (default)
│   └── version.go                  # Version command
├── internal/
│   ├── config/
│   │   ├── config.go               # Config struct and loader
│   │   └── validate.go             # Config validation
│   ├── agents/
│   │   ├── agent.go                # Agent interface
│   │   ├── codex.go                # Codex CLI wrapper
│   │   ├── claude.go               # Claude CLI wrapper
│   │   ├── kilocode.go             # Kilocode CLI wrapper
│   │   └── executor.go             # Common execution logic
│   ├── review/
│   │   ├── orchestrator.go         # Main review orchestration
│   │   ├── prompt.go               # Prompt building and templating
│   │   └── selector.go             # Agent selection logic
│   ├── input/
│   │   ├── git.go                  # Git repo scanning
│   │   └── stdin.go                # Stdin reader
│   ├── ui/
│   │   ├── model.go                # Bubbletea main model
│   │   ├── split_view.go           # Split screen for 2 reviewers
│   │   ├── single_view.go          # Single screen for aggregate
│   │   └── markdown.go             # Markdown rendering (glamour)
│   └── output/
│       ├── writer.go               # Save reviews to files
│       └── formatter.go            # Format output
├── prompts/
│   ├── reviewer.txt                # Base prompt for reviewers
│   └── aggregator.txt              # Base prompt for aggregator
├── .neonflare.yaml.example         # Example config
└── README.md
```

## Core Features

### 1. Configuration Management
**File:** `internal/config/config.go`

```yaml
# .neonflare.yaml
agents:
  codex:
    enabled: true
    model: "gpt-4"
    timeout: 300s
    cli_path: "codex"  # or full path

  claude:
    enabled: true
    model: "claude-sonnet-4"
    timeout: 300s
    cli_path: "claude"

  kilocode:
    enabled: true
    model: "default"
    timeout: 300s
    cli_path: "kilocode"

output:
  dir: ".neonflare-reviews"  # Where to save markdown files
  timestamp: true             # Add timestamp to filenames

prompts:
  reviewer_template: "prompts/reviewer.txt"
  aggregator_template: "prompts/aggregator.txt"
```

**CLI Flags Override:**
- `--agents`: Manually specify agents (e.g., `--agents=codex,claude,kilocode`)
- `--model-codex`, `--model-claude`, `--model-kilocode`: Override models
- `--timeout`: Global timeout override
- `--output-dir`: Override output directory
- `--auto`: Enable one-shot mode (vs interactive)

### 2. Agent Interface
**File:** `internal/agents/agent.go`

```go
type Agent interface {
    Name() string
    Execute(ctx context.Context, prompt string, input string) (string, error)
    IsAvailable() bool  // Check if CLI is installed
}

type AgentConfig struct {
    Model    string
    Timeout  time.Duration
    CLIPath  string
}
```

Each agent implementation (codex, claude, kilocode) wraps the installed CLI:
- Builds command with appropriate flags
- Passes input via stdin or temp file
- Captures stdout as review result
- Handles errors and timeouts

### 3. Review Orchestration
**File:** `internal/review/orchestrator.go`

**Flow:**
1. **Agent Selection:** Randomly pick 2 reviewers + 1 aggregator (or use user-specified)
2. **Prepare Input:** Load git repo or read stdin
3. **Build Prompts:** Combine base prompts with user instructions
4. **Execute Reviews:** Run 2 reviewers in parallel
5. **Aggregate:** Pass both reviews to aggregator agent
6. **Save Results:** Write all 3 outputs as markdown files
7. **Display:** Show aggregate review in UI

**Parallel Execution:**
- Use goroutines for the 2 reviewer agents
- Wait for both before starting aggregator

### 4. Prompt Building
**File:** `internal/review/prompt.go`

**Reviewer Prompt Template:**
```
You are a code reviewer. Analyze the following code and provide:
- Issues and bugs
- Code quality concerns
- Security vulnerabilities
- Performance considerations
- Best practice violations

{{ if .UserPrompt }}
Additional instructions: {{ .UserPrompt }}
{{ end }}

Code to review:
{{ .Code }}
```

**Aggregator Prompt Template:**
```
You are reviewing two code reviews from other AI agents.
Your task is to synthesize their findings into a single, coherent review.

- Identify common findings (high confidence)
- Note conflicting opinions
- Prioritize critical issues
- Remove redundancy
- Provide actionable recommendations

{{ if .UserPrompt }}
Additional instructions: {{ .UserPrompt }}
{{ end }}

Review 1 ({{ .Agent1Name }}):
{{ .Review1 }}

Review 2 ({{ .Agent2Name }}):
{{ .Review2 }}
```

### 5. Input Handling

**Git Repo Mode:**
- Accept path to git repo
- Option to review: working directory, staged changes, specific commit, or diff
- Use `git diff` or `git show` to get content
- Filter files by patterns (ignore vendored code, node_modules, etc.)

**Stdin Mode:**
- Read code from stdin
- Useful for piping: `git diff | neonflare-review --stdin`

### 6. Bubbletea UI

**One-Shot Mode (`--auto`):**

**Split View** (during parallel reviews):
```
┌─────────────────────────────────────────────────────────────────┐
│ Review 1: Codex (gpt-4)                │ Review 2: Claude       │
├─────────────────────────────────────────────────────────────────┤
│                                         │                        │
│ [Streaming output from codex...]       │ [Streaming from...]    │
│                                         │                        │
│ • Found SQL injection vulnerability    │ • Security issue...    │
│ • Unused variable on line 42           │ • Performance...       │
│ ...                                     │ ...                    │
│                                         │                        │
│ Status: In Progress ⚡                  │ Status: In Progress ⚡ │
└─────────────────────────────────────────────────────────────────┘
```

**Single View** (during aggregation):
```
┌──────────────────────────────────────────────────────────┐
│ Aggregating Reviews: Kilocode                            │
├──────────────────────────────────────────────────────────┤
│                                                          │
│ [Streaming aggregated review...]                        │
│                                                          │
│ ## Critical Issues                                       │
│ Both reviewers identified:                               │
│ • SQL injection vulnerability in db.go:123               │
│   Recommendation: Use parameterized queries              │
│                                                          │
│ Status: In Progress ⚡                                   │
└──────────────────────────────────────────────────────────┘
```

**Interactive Mode** (no `--auto`):
- Start screen: Select agents, configure options
- Progress indicators during review
- Final screen: Display aggregate review with markdown rendering (using glamour)
- Options to: save, copy to clipboard, open in editor

### 7. Output Management
**File:** `internal/output/writer.go`

Save 3 markdown files:
```
.neonflare-reviews/
├── 2024-01-15_143022_codex_review.md
├── 2024-01-15_143022_claude_review.md
└── 2024-01-15_143022_aggregate.md
```

Each file includes:
- Timestamp
- Agent name and model
- Input summary (repo path, commit hash, etc.)
- Review content

## Implementation Phases

### Phase 1: Core Infrastructure ✅ COMPLETED
- [x] Project setup (go mod init)
- [x] Cobra CLI structure
- [x] Config loader (.neonflare.yaml)
- [x] Agent interface definition
- [x] Basic orchestrator
- [x] Example config and prompts
- [x] README and documentation

### Phase 2: Agent Implementations ✅ COMPLETED
- [x] Codex CLI wrapper (stub implementation)
- [x] Claude CLI wrapper (stub implementation)
- [x] Kilocode CLI wrapper (stub implementation)
- [x] Executor with timeout/error handling
- [x] Tests for config and selector
- [x] Makefile for build/test automation

### Phase 3: Input & Prompts ✅ COMPLETED
- [x] Git repo input handler (diff, staged, commit options)
- [x] Stdin input handler
- [x] Prompt templates (embedded defaults + file support)
- [x] Prompt builder with user instructions
- [x] Complete CLI integration

### Phase 4: UI (Bubbletea) ✅ MOSTLY COMPLETED
- [x] Basic model setup (Bubbletea model with state management)
- [x] Split view component (parallel reviews side-by-side)
- [x] Single view component (aggregate review)
- [x] Markdown rendering (Glamour integration)
- [x] One-shot mode with `--auto` flag
- [ ] Fully interactive mode (see Phase 7 below)

**Current State:**
- `--auto` mode displays beautiful split-screen UI showing parallel reviews in real-time, then switches to single view for the aggregate
- Console mode (without `--auto`) uses simple text output
- All CLI arguments must be specified upfront

**Interactive Mode (Future):** See Phase 7 for detailed design of menu-driven TUI experience.

### Phase 5: Output & Polish ✅ MOSTLY COMPLETED
- [x] File writer (saves 3 markdown files)
- [x] Output formatting
- [x] Error handling
- [x] Tests (config, selector)
- [ ] More comprehensive tests (agents, input, output)
- [ ] Logging

### Phase 6: Documentation & Examples ✅ COMPLETED
- [x] README with usage examples (Quick Start section)
- [x] Example .neonflare.yaml (.neonflare.yaml.example)
- [x] Example prompts (prompts/reviewer.txt, prompts/aggregator.txt)
- [x] Installation instructions (README + Makefile)
- [x] Development guide (make targets, testing)
- [x] Agent requirements and links

## Dependencies

```go
require (
    github.com/spf13/cobra              // CLI framework
    github.com/spf13/viper              // Config management
    github.com/charmbracelet/bubbletea  // TUI framework (✅ installed)
    github.com/charmbracelet/lipgloss   // TUI styling (✅ installed)
    github.com/charmbracelet/glamour    // Markdown rendering (✅ installed)
    gopkg.in/yaml.v3                    // YAML parsing
)
```

## CLI Usage Examples

```bash
# Review git repo (random agents)
neonflare-review /path/to/repo

# Review with specific agents
neonflare-review --agents=codex,claude,kilocode /path/to/repo

# Review staged changes
neonflare-review --staged /path/to/repo

# Review specific commit
neonflare-review --commit=abc123 /path/to/repo

# Review from stdin
git diff | neonflare-review --stdin

# One-shot mode with custom prompt
neonflare-review --auto --prompt="Focus on security issues" /path/to/repo

# Interactive mode (default)
neonflare-review /path/to/repo

# Specify models
neonflare-review --model-claude=claude-opus-4 /path/to/repo
```

## Phase 7: Interactive Mode (Future Enhancement)

A fully interactive TUI experience with menu-driven navigation (like lazygit, k9s).

### Components to Build
- `internal/ui/menu.go` - Menu navigation component
- `internal/ui/agent_picker.go` - Agent selection screen with checkboxes
- `internal/ui/config_editor.go` - Configuration screen (models, prompts)
- `internal/ui/confirm.go` - Review confirmation screen
- `internal/ui/post_review.go` - Post-review action menu
- `internal/ui/interactive.go` - Main interactive flow orchestrator

### User Flow
1. **Welcome Screen** - Choose what to review (repo, staged, commit, stdin)
2. **Agent Selection** - Pick 3 agents or use random assignment
3. **Configuration** - Override models, add custom prompts, set output dir
4. **Confirmation** - Preview settings before starting
5. **Review Progress** - Same split-screen/single view as `--auto` mode
6. **Post-Review Menu** - View reviews, copy to clipboard, start new review

### Features
- **Keyboard Navigation**: ↑↓ arrows, Enter to select, Space to toggle, `b` for back, `q` to quit
- **Smart Defaults**: Auto-detect git repo, pre-select available agents, remember last config
- **Input Validation**: Catch errors before starting review
- **Visual Feedback**: Show agent availability, loading states, helpful hints
- **Accessibility**: Help menu with `?`, clear status indicators

### Launch Methods
```bash
# Launch interactive mode
./neonflare-review --interactive

# Or make it default when no args provided
./neonflare-review
```

### Benefits
- Discoverability: Users can explore without reading docs
- Flexibility: Easy to change settings between reviews
- Professional UX: Polished experience like modern TUI tools
- Lower barrier to entry: No need to memorize CLI flags

---

## Future Enhancements (Beyond Phase 7)
- [ ] Web UI for viewing saved reviews
- [ ] Git integration (comment on PRs)
- [ ] Custom agent plugins
- [ ] Review history and comparison
- [ ] CI/CD integration
- [ ] Agent performance metrics
- [ ] Parallel batch reviews (multiple files)
- [ ] Review templates and presets
- [ ] Diff highlighting in reviews
- [ ] Agent performance analytics
