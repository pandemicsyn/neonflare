package agents

import (
	"context"
	"fmt"
)

// CodexAgent implements the Agent interface for OpenAI Codex
type CodexAgent struct {
	*BaseAgent
}

// NewCodexAgent creates a new Codex agent
func NewCodexAgent(cfg Config) *CodexAgent {
	return &CodexAgent{
		BaseAgent: NewBaseAgent(cfg),
	}
}

// Execute runs Codex with the given prompt and input
func (a *CodexAgent) Execute(ctx context.Context, prompt string, input string) (string, error) {
	// Build the full prompt with code to review
	fullPrompt := fmt.Sprintf("%s\n\nCode to review:\n%s", prompt, input)

	// Use codex exec for non-interactive execution
	// Format: codex exec -m <model> <prompt>
	args := []string{
		"exec",
		"-m", a.config.Model,
		"--dangerously-bypass-approvals-and-sandbox", // For autonomous execution
		fullPrompt,
	}

	// Execute the command
	output, err := a.ExecuteCommand(ctx, args, "")
	if err != nil {
		return "", fmt.Errorf("codex execution failed: %w", err)
	}

	return output, nil
}
