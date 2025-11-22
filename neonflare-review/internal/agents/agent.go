package agents

import (
	"context"
	"time"
)

// Agent represents an AI agent that can perform code reviews
type Agent interface {
	// Name returns the agent's identifier (e.g., "codex", "claude", "kilocode")
	Name() string

	// Execute runs the agent with the given prompt and input code
	// Returns the agent's response or an error
	Execute(ctx context.Context, prompt string, input string) (string, error)

	// IsAvailable checks if the agent's CLI is installed and accessible
	IsAvailable() bool
}

// Config contains configuration for an agent
type Config struct {
	Name    string
	Model   string
	Timeout time.Duration
	CLIPath string
}

// Review represents the output from an agent's review
type Review struct {
	AgentName string    // Name of the agent that performed the review
	Model     string    // Model used by the agent
	Content   string    // The review content (markdown)
	StartTime time.Time // When the review started
	EndTime   time.Time // When the review completed
	Duration  time.Duration
	Error     error // Any error that occurred
}

// ReviewRequest encapsulates the input for a review
type ReviewRequest struct {
	Code       string // The code to review
	Prompt     string // The prompt to send to the agent
	UserPrompt string // Optional user-provided additional instructions
}
