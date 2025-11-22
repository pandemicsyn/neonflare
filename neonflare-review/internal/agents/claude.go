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
	// Build the full prompt
	fullPrompt := fmt.Sprintf("%s\n\n%s", prompt, input)

	// TODO: Determine the correct CLI args for claude
	// For now, we'll use a placeholder that assumes a --auto flag
	args := []string{
		"--auto",
		fmt.Sprintf("--model=%s", a.config.Model),
	}

	// Execute the command with the prompt as stdin
	output, err := a.ExecuteCommand(ctx, args, fullPrompt)
	if err != nil {
		return "", fmt.Errorf("claude execution failed: %w", err)
	}

	return output, nil
}
