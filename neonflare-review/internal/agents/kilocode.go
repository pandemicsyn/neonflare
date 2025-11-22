package agents

import (
	"context"
	"fmt"
)

// KilocodeAgent implements the Agent interface for Kilocode
type KilocodeAgent struct {
	*BaseAgent
}

// NewKilocodeAgent creates a new Kilocode agent
func NewKilocodeAgent(cfg Config) *KilocodeAgent {
	return &KilocodeAgent{
		BaseAgent: NewBaseAgent(cfg),
	}
}

// Execute runs Kilocode with the given prompt and input
func (a *KilocodeAgent) Execute(ctx context.Context, prompt string, input string) (string, error) {
	// Build the full prompt
	fullPrompt := fmt.Sprintf("%s\n\n%s", prompt, input)

	// TODO: Determine the correct CLI args for kilocode
	// The user mentioned: kilocode --auto "review this code"
	args := []string{
		"--auto",
		fullPrompt, // Kilocode takes the prompt as an argument
	}

	// For kilocode, we might pass the code via stdin
	output, err := a.ExecuteCommand(ctx, args, input)
	if err != nil {
		return "", fmt.Errorf("kilocode execution failed: %w", err)
	}

	return output, nil
}
