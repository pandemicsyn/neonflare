package mining

import (
	"fmt"
	"strings"
)

// PromptConfig contains the parameters for building a mining prompt
type PromptConfig struct {
	Repository    string
	PRCount       int
	Since         string
	Update        bool
	ExistingRules string // Content of existing rules file (for update mode)
	FocusAreas    []string
}

// BuildMiningPrompt generates the prompt for the agent to mine PR comments
func BuildMiningPrompt(config PromptConfig) string {
	var prompt strings.Builder

	// Base instructions
	prompt.WriteString(fmt.Sprintf(
		"Please use the GitHub CLI tool (gh) to fetch the last %d merged pull requests "+
			"from the repository %s",
		config.PRCount,
		config.Repository,
	))

	// Add time constraint if specified
	if config.Since != "" {
		prompt.WriteString(fmt.Sprintf(", merged since %s", config.Since))
	}

	prompt.WriteString(", then analyze the PR comments for commonly flagged "+
		"issues or high-signal feedback that automated reviews should explicitly look for.\n\n")

	// Task breakdown
	prompt.WriteString("Your task:\n")
	prompt.WriteString(fmt.Sprintf("1. Use `gh pr list --repo %s --state merged --limit %d --json number` to get PR numbers\n",
		config.Repository, config.PRCount))

	if config.Since != "" {
		prompt.WriteString(fmt.Sprintf("   (Filter to only PRs merged since %s)\n", config.Since))
	}

	prompt.WriteString("2. For each PR, fetch review comments with `gh pr view <number> --repo " + config.Repository + " --json comments,reviews`\n")
	prompt.WriteString("3. Analyze the comments to identify patterns that appear multiple times\n")
	prompt.WriteString("4. Focus on actionable, specific feedback (not general praise or discussion)\n")

	// Update mode: compare with existing rules
	if config.Update && config.ExistingRules != "" {
		prompt.WriteString("5. Compare new patterns with the existing rules below\n")
		prompt.WriteString("6. Merge new insights with existing patterns, updating frequencies\n")
		prompt.WriteString("7. Generate an updated review prompt profile\n\n")

		prompt.WriteString("### Existing Rules to Update:\n")
		prompt.WriteString("```markdown\n")
		prompt.WriteString(config.ExistingRules)
		prompt.WriteString("\n```\n\n")
	} else {
		prompt.WriteString("5. Generate a structured review prompt profile\n\n")
	}

	// Focus areas if specified
	if len(config.FocusAreas) > 0 {
		prompt.WriteString(fmt.Sprintf("**Special Focus:** Pay particular attention to comments related to: %s\n\n",
			strings.Join(config.FocusAreas, ", ")))
	}

	// Output format
	prompt.WriteString("Output format should be a markdown file with:\n")
	prompt.WriteString("- A clear title describing the rules (e.g., \"Team Review Rules for [repo]\")\n")
	prompt.WriteString("- A list of common issues/patterns found\n")
	prompt.WriteString("- Frequency of each pattern (how many PRs mentioned it)\n")
	prompt.WriteString("- Specific guidance for reviewers on what to look for\n")
	prompt.WriteString("- 1-2 concrete examples from the actual PR comments\n")
	prompt.WriteString("- Categories (e.g., Security, Performance, Code Quality, Style)\n\n")

	prompt.WriteString("Format the output as a prompt profile that can be used directly for reviews. ")
	prompt.WriteString("Write it in second person (\"You are reviewing...\", \"Look for...\") so it can be ")
	prompt.WriteString("prepended to review prompts.\n\n")

	prompt.WriteString("**Important:** Only include patterns that appeared at least 3 times. ")
	prompt.WriteString("Prioritize issues by frequency and severity.")

	return prompt.String()
}

// BuildMultiRepoPrompt generates a prompt for mining across multiple repositories
func BuildMultiRepoPrompt(repos []string, prCount int, since string, focusAreas []string) string {
	var prompt strings.Builder

	prompt.WriteString(fmt.Sprintf(
		"Please use the GitHub CLI tool (gh) to fetch the last %d merged pull requests "+
			"from each of the following repositories: %s",
		prCount,
		strings.Join(repos, ", "),
	))

	if since != "" {
		prompt.WriteString(fmt.Sprintf(", merged since %s", since))
	}

	prompt.WriteString(".\n\n")

	prompt.WriteString("Your task:\n")
	prompt.WriteString("1. For each repository, use `gh pr list --repo <repo> --state merged --limit " +
		fmt.Sprintf("%d", prCount) + " --json number`\n")
	prompt.WriteString("2. Fetch review comments for each PR\n")
	prompt.WriteString("3. Aggregate patterns across all repositories\n")
	prompt.WriteString("4. Identify common issues that appear across multiple projects\n")
	prompt.WriteString("5. Generate unified rules that apply organization-wide\n\n")

	if len(focusAreas) > 0 {
		prompt.WriteString(fmt.Sprintf("**Special Focus:** Pay particular attention to: %s\n\n",
			strings.Join(focusAreas, ", ")))
	}

	prompt.WriteString("Output should be a comprehensive prompt profile suitable for reviewing ")
	prompt.WriteString("any project in this organization, with patterns grouped by category and ")
	prompt.WriteString("annotated with which repositories they came from.")

	return prompt.String()
}
