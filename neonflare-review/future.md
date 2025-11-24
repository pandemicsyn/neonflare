# Future Feature Ideas

This document outlines planned features and enhancements for neonflare-review.

## Review History Browser

**Goal:** Provide a TUI interface to browse, search, and compare past reviews stored in `~/.config/neonflare/reviews`.

### Features

#### Basic Browser
- List all reviews with metadata (date, agents used, file path, profile)
- Vim-style navigation (j/k to scroll, / to search)
- Filter by date range, agent, prompt profile
- View full review with markdown rendering (reuse existing Glamour setup)

#### Search & Filter
- Full-text search across review content
- Filter by severity keywords (critical, warning, security, etc.)
- Filter by file patterns (`*.ts`, `src/**`, etc.)
- Saved filter presets

#### Comparison View
- Select 2+ reviews of the same code at different points in time
- Side-by-side diff of review findings
- Highlight new issues vs resolved issues
- Track issue lifecycle across commits

### Implementation Notes

```
Entry point: --history flag or new menu option "Browse Review History"

File structure:
  internal/ui/screens/history_browser.go  - Main browser screen
  internal/history/
    reader.go      - Parse and index review files
    search.go      - Full-text search implementation
    compare.go     - Comparison logic
```

### User Workflows

1. **Quick lookup:** `neonflare-review --history --search "authentication"`
2. **Browse mode:** Interactive TUI with file listing
3. **Compare commits:** `neonflare-review --history --compare abc123..def456`

---

## Review Rules Mining

**Goal:** Extract team-specific review patterns from historical PR comments to generate custom review rules and prompts.

### Concept

Human reviewers leave consistent feedback on PRs. By mining these comments, we can:
1. Identify frequently mentioned issues
2. Generate review rules aligned with team standards
3. Create specialized prompt profiles automatically
4. Improve review quality over time

### Implementation Strategy

**Core Approach:** Let the agents do the intelligent work! Instead of writing complex parsing/clustering code, we prompt an agent to analyze PR comments and extract patterns.

#### Phase 1: Prompt-Based Mining

When user runs: `neonflare-review mine-rules --repo owner/repo --prs 100`

We construct a prompt and send it to a selected agent (e.g., claude or kilocode):

```
Please use the GitHub CLI tool (gh) to fetch the last 100 merged pull requests
from the repository owner/repo, then analyze the PR comments for commonly flagged
issues or high-signal feedback that automated reviews should explicitly look for.

Your task:
1. Use `gh pr list --state merged --limit 100 --json number` to get PR numbers
2. For each PR, fetch review comments with `gh pr view <number> --json comments`
3. Analyze the comments to identify patterns that appear multiple times
4. Focus on actionable, specific feedback (not general praise or discussion)
5. Generate a structured review prompt profile

Output format should be a markdown file with:
- A list of common issues/patterns found
- Frequency of each pattern
- Specific guidance for reviewers
- Examples from the actual PR comments

Format the output as a prompt profile that can be used directly for reviews.
```

The agent will:
- Execute `gh` commands via Bash tool
- Parse the JSON output
- Identify patterns intelligently (it's an LLM, it's good at this!)
- Generate structured markdown output

#### Phase 2: Save Results

Take the agent's output and save it to:
```
~/.config/neonflare/reviewer-prompts/rules/
  team-rules-{repo-name}-{date}.md
```

User can then use it: `neonflare-review --profile team-rules-myrepo-2024-01-15`

#### Phase 3: Iteration & Refinement

```bash
# Update rules with more recent PRs
neonflare-review mine-rules --repo owner/repo --prs 50 --since "30 days ago" --update

# This prompts the agent to:
# 1. Load existing rules file
# 2. Fetch new PRs since last update
# 3. Merge new patterns with existing ones
# 4. Update frequencies and examples
```

### CLI Interface

```bash
# Mine rules from recent PRs
neonflare-review mine-rules --repo owner/repo --prs 100

# Output:
# ✓ Fetched 100 merged PRs
# ✓ Extracted 247 review comments
# ✓ Found 15 common patterns
# ✓ Generated prompt profile: team-rules.md
#
# Top patterns:
#   1. Unnecessary try-catch (12 occurrences)
#   2. Console.log statements (15 occurrences)
#   3. Missing type annotations (9 occurrences)

# Use mined rules in review
neonflare-review --profile team-rules

# Update rules periodically
neonflare-review mine-rules --update --since "30 days ago"
```

### Technical Design

**Much simpler than originally planned!** We leverage the existing agent infrastructure.

```
cmd/mine_rules.go
  - Parse CLI flags: --repo, --prs, --since, --update, --agent
  - Build mining prompt
  - Execute agent with prompt
  - Save output to ~/.config/neonflare/reviewer-prompts/rules/

internal/mining/
  prompt.go         - Build mining prompt templates
  runner.go         - Execute agent with mining prompt
  saver.go          - Save results to rules directory
```

**Storage:**
```
~/.config/neonflare/reviewer-prompts/
  rules/
    team-rules-myrepo-2024-01-15.md
    team-rules-myrepo-2024-02-15.md  (updated version)
    team-rules-otherrepo-2024-01-20.md
```

**Key insight:** The agent does the hard work of:
- Fetching data via `gh` CLI
- Parsing JSON responses
- Identifying patterns (LLMs are great at this!)
- Generating structured output
- Clustering similar issues

We just need to:
1. Build the prompt
2. Run the agent
3. Save the result

### Advanced Features

#### Evolution Tracking
Prompt the agent to compare old vs new rules:

```bash
# See how team standards evolve
neonflare-review mine-rules --repo owner/repo --prs 100 --compare team-rules-myrepo-2023-08-15.md

# Agent prompt includes:
# "Compare these new patterns with the existing rules file. Highlight:
# - New concerns that have emerged
# - Issues that are now resolved/less common
# - Changes in frequency/severity"
```

#### Custom Focus Areas
```bash
# Focus on specific areas
neonflare-review mine-rules --repo owner/repo --focus "security,performance"

# Agent prompt includes:
# "Focus specifically on security and performance-related comments"
```

#### Multi-Repo Aggregation
```bash
# Mine patterns across multiple repos
neonflare-review mine-rules --repos "org/repo1,org/repo2,org/repo3" --prs 50

# Agent analyzes all repos and generates unified rules
```

### Privacy & Ethics

**Considerations:**
- Only mine public repos or with explicit permission
- Option to exclude certain reviewers/comments
- Anonymize examples in generated rules
- Allow manual review/approval before use

### Integration with Existing Features

**Prompt Profiles:**
- Mined rules become specialized prompt profiles
- Combine with manual profiles (e.g., `frontend-expert.md` + `team-rules.md`)

**Review Aggregation:**
- Aggregator can check findings against mined rules
- Flag "this matches a known team pattern"

**Confirmation Screen:**
- Show "Using 15 team-specific rules from 100 PRs" in metadata

---

## Implementation Priority

1. **Review History Browser** - Easier to implement, immediate value
   - Phase 1: Basic listing and viewing
   - Phase 2: Search and filtering
   - Phase 3: Comparison features

2. **Review Rules Mining** - More complex, higher impact
   - Phase 1: Basic PR comment collection
   - Phase 2: Simple pattern extraction
   - Phase 3: Automated profile generation
   - Phase 4: Continuous learning loop

---

## Open Questions

### Review History Browser
- Storage format: Keep current markdown or add structured metadata?
- Index strategy: Pre-index or search on-demand?
- Export formats: Support HTML, PDF?

### Review Rules Mining
- LLM for clustering: Which model? Local vs API?
- Update frequency: Manual trigger vs automatic?
- Rule conflicts: How to handle contradictory patterns?
- Privacy: Store raw comments locally only?

---

## Success Metrics

### Review History Browser
- Time to find specific past review < 10 seconds
- User adoption: 50%+ of users browse history monthly
- Feature request: Export to team documentation

### Review Rules Mining
- Quality: 80%+ of mined rules are useful
- Coverage: Find 10+ meaningful patterns per 100 PRs
- Effectiveness: Reviews with mined rules catch 30% more team-specific issues
- Adoption: Teams run mining weekly/monthly
