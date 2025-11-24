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

#### Phase 1: PR Comment Collection
```bash
# Use gh CLI to fetch PR comments
gh pr list --state merged --limit 100 --json number
gh pr view <number> --json comments

# Extract review comments (not general discussion)
# Focus on:
# - File-specific comments
# - Change requests
# - Patterns that appear multiple times
```

#### Phase 2: Pattern Extraction

**Input:** Raw PR comments from GitHub
**Output:** Structured review rules

```yaml
# Example mined rule
rule:
  pattern: "unnecessary try-catch"
  frequency: 12  # Appeared in 12 PRs
  examples:
    - "This try-catch isn't needed here - the error will bubble up"
    - "We don't need to catch this, let it propagate"
    - "Remove this try-catch wrapper, it's redundant"

  generated_instruction: |
    Look for unnecessary try-catch blocks that don't add value:
    - Catch blocks that just rethrow
    - Wrapping already-safe operations
    - Generic error handling without context
```

#### Phase 3: Rule Application

**Option A: Generate Prompt Profiles**
```markdown
# Auto-generated: frontend-team-rules.md
Based on 100 recent PRs reviewed by the team.

Common issues to watch for:

1. **Unnecessary try-catch blocks** (mentioned 12 times)
   - Look for catch blocks that only rethrow
   - Flag wrapping of operations that can't fail

2. **Missing accessibility attributes** (mentioned 8 times)
   - Every interactive element needs aria-label
   - Buttons should have descriptive text or aria-label

3. **Console.log statements** (mentioned 15 times)
   - No console.log in production code
   - Use proper logging framework
```

**Option B: Direct Rule Injection**
- Add rules to review prompt dynamically
- Weight rules by frequency/importance
- Update rules weekly/monthly

#### Phase 4: Continuous Learning

**Feedback Loop:**
1. Run reviews with mined rules
2. Track which flagged issues get fixed
3. Increase weight of effective rules
4. Deprecate rules that don't lead to changes

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

```
internal/mining/
  collector.go      - Fetch PR comments via gh CLI
  parser.go         - Parse comments, extract patterns
  clusterer.go      - Group similar comments
  generator.go      - Generate prompt profiles from rules

Storage:
  ~/.config/neonflare/mined-rules/
    raw-comments.json          - Cached PR comments
    patterns.json              - Extracted patterns with metadata
    team-rules.md              - Generated prompt profile
    effectiveness-scores.json  - Track rule effectiveness
```

### Advanced Features

#### Semantic Clustering
- Use LLM to cluster similar comments (e.g., group all async/await issues)
- Generate rule categories automatically
- Detect new emerging patterns

#### Team-Specific Learning
```bash
# Different teams, different rules
neonflare-review mine-rules --repo owner/repo --team frontend
neonflare-review mine-rules --repo owner/repo --team backend

# Generates:
# - frontend-team-rules.md
# - backend-team-rules.md
```

#### Severity Detection
- Analyze comment tone and language
- Classify as: critical, important, suggestion, nitpick
- Weight rules by severity in review prompts

#### Evolution Tracking
```bash
# See how team standards evolve
neonflare-review mine-rules --compare "6 months ago" vs "now"

# Output:
# New concerns (last 6 months):
#   - Performance: React re-renders (8 mentions)
#   - Security: Input sanitization (6 mentions)
#
# Resolved concerns:
#   - Linting issues (dropped from 20 to 2)
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
