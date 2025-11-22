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

	// Use claude --print for non-interactive execution
	// Format: claude --print --model <model> <prompt>
	args := []string{
		"--print",
		"--model", a.config.Model,
		"--output-format", "text",
		"--dangerously-skip-permissions", // For autonomous execution
		fullPrompt,
	}

	// Execute the command
	output, err := a.ExecuteCommand(ctx, args, "")
	if err != nil {
		return "", fmt.Errorf("claude execution failed: %w", err)
	}

	return output, nil
}
