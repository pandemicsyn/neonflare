package agents

import (
	"context"
	"fmt"
)

// ClaudeAgent implements the Agent interface for Anthropic Claude
type ClaudeAgent struct {
	*BaseAgent
}

// NewClaudeAgent creates a new Claude agent
func NewClaudeAgent(cfg Config) *ClaudeAgent {
	return &ClaudeAgent{
		BaseAgent: NewBaseAgent(cfg),
	}
}

// Execute runs Claude with the given prompt and input
func (a *ClaudeAgent) Execute(ctx context.Context, prompt string, input string) (string, error) {
	// Build the full prompt with code to review
	fullPrompt := fmt.Sprintf("%s\n\nCode to review:\n%s", prompt, input)

	// Check if prompt is too large (Claude has ~200K token limit, ~800KB text limit)
	// Warn if approaching limits
	if len(fullPrompt) > 500000 { // 500KB
		return "", fmt.Errorf("prompt too large (%d bytes). Try reviewing smaller changesets using --staged or --commit flags", len(fullPrompt))
	}

	// Use claude --print for non-interactive execution
	// Pass prompt via stdin to avoid command-line length limits
	args := []string{
		"--print",
		"--model", a.config.Model,
		"--output-format", "text",
		"--dangerously-skip-permissions", // For autonomous execution
	}

	// Execute the command with prompt via stdin
	output, err := a.ExecuteCommand(ctx, args, fullPrompt)
	if err != nil {
		// Add helpful context for common errors
		errMsg := err.Error()
		if contains(errMsg, "Prompt is too long") || contains(errMsg, "too long") {
			return "", fmt.Errorf("claude execution failed: prompt too large (%d bytes). Try reviewing smaller changesets:\n  --staged: review only staged changes\n  --commit HEAD: review last commit\n  --commit HEAD~5..HEAD: review last 5 commits", len(fullPrompt))
		}
		return "", fmt.Errorf("claude execution failed: %w", err)
	}

	return output, nil
}

// contains checks if a string contains a substring (case-insensitive helper)
func contains(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(substr) == 0 ||
		(len(s) > 0 && (s[0:len(substr)] == substr || contains(s[1:], substr))))
}
