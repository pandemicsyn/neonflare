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
	// Build the full prompt
	fullPrompt := fmt.Sprintf("%s\n\n%s", prompt, input)

	// TODO: Determine the correct CLI args for codex
	// For now, we'll use a placeholder that assumes a --auto flag
	args := []string{
		"--auto",
		fmt.Sprintf("--model=%s", a.config.Model),
	}

	// Execute the command with the prompt as stdin
	output, err := a.ExecuteCommand(ctx, args, fullPrompt)
	if err != nil {
		return "", fmt.Errorf("codex execution failed: %w", err)
	}

	return output, nil
}
