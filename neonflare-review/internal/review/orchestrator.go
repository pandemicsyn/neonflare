package review

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/pandemicsyn/neonflare/neonflare-review/internal/agents"
	"github.com/pandemicsyn/neonflare/neonflare-review/internal/config"
)

// Orchestrator manages the multi-agent review process
type Orchestrator struct {
	cfg    *config.Config
	agents map[string]agents.Agent
}

// NewOrchestrator creates a new review orchestrator
func NewOrchestrator(cfg *config.Config) *Orchestrator {
	return &Orchestrator{
		cfg:    cfg,
		agents: make(map[string]agents.Agent),
	}
}

// RegisterAgent registers an agent with the orchestrator
func (o *Orchestrator) RegisterAgent(agent agents.Agent) {
	o.agents[agent.Name()] = agent
}

// Result contains the complete review results
type Result struct {
	Reviewer1     string
	Reviewer2     string
	Review1       *agents.Review
	Review2       *agents.Review
	TotalDuration time.Duration
}

// ProgressCallback is called with progress updates during the review
type ProgressCallback func(event ProgressEvent)

// ProgressEvent represents a progress update
type ProgressEvent struct {
	Type      string // "reviewer_start", "reviewer_done", "reviewer_output"
	Reviewer  int    // 1 or 2 for reviewers, 0 for aggregator
	AgentName string
	Review    *agents.Review // Only set for "done" events
	Content   string         // Partial output for "reviewer_output" events
}

// RunReview orchestrates the complete review process
func (o *Orchestrator) RunReview(ctx context.Context, code string, userPrompt string, specifiedAgents []string) (*Result, error) {
	return o.RunReviewWithCallback(ctx, code, userPrompt, specifiedAgents, nil)
}

// RunReviewWithCallback orchestrates the review process with progress callbacks
func (o *Orchestrator) RunReviewWithCallback(ctx context.Context, code string, userPrompt string, specifiedAgents []string, callback ProgressCallback) (*Result, error) {
	startTime := time.Now()

	// Get available agents
	available := o.cfg.GetEnabledAgents()

	// Select agents (just 2 reviewers, no aggregator)
	reviewer1Name, reviewer2Name, err := SelectAgents(available, specifiedAgents)
	if err != nil {
		return nil, fmt.Errorf("failed to select agents: %w", err)
	}

	// Get agent instances
	reviewer1 := o.agents[reviewer1Name]
	reviewer2 := o.agents[reviewer2Name]

	if reviewer1 == nil || reviewer2 == nil {
		return nil, fmt.Errorf("one or more selected agents not registered")
	}

	// Build reviewer prompts using file-based approach
	// Instead of embedding code in prompt, use file-based instructions
	reviewSource := "the code in the current directory"
	reviewerPrompt, err := BuildReviewerPromptWithPath(
		o.cfg.Prompts.ReviewerTemplate,
		"", // Let agents discover files via git commands
		reviewSource,
		userPrompt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to build reviewer prompt: %w", err)
	}

	// Run two reviewers in parallel
	// Pass empty string for code - agents will use tools to read files
	var wg sync.WaitGroup
	var review1, review2 *agents.Review

	wg.Add(2)

	// Reviewer 1
	go func() {
		defer wg.Done()
		if callback != nil {
			callback(ProgressEvent{Type: "reviewer_start", Reviewer: 1, AgentName: reviewer1Name})
		}
		// Create streaming callback for reviewer 1
		var outputCallback agents.OutputCallback
		if callback != nil {
			outputCallback = func(chunk string) {
				callback(ProgressEvent{
					Type:      "reviewer_output",
					Reviewer:  1,
					AgentName: reviewer1Name,
					Content:   chunk,
				})
			}
		}
		review1 = o.executeReviewWithCallback(ctx, reviewer1, reviewerPrompt, "", outputCallback) // Empty code - use tools
		if callback != nil {
			callback(ProgressEvent{Type: "reviewer_done", Reviewer: 1, AgentName: reviewer1Name, Review: review1})
		}
	}()

	// Reviewer 2
	go func() {
		defer wg.Done()
		if callback != nil {
			callback(ProgressEvent{Type: "reviewer_start", Reviewer: 2, AgentName: reviewer2Name})
		}
		// Create streaming callback for reviewer 2
		var outputCallback agents.OutputCallback
		if callback != nil {
			outputCallback = func(chunk string) {
				callback(ProgressEvent{
					Type:      "reviewer_output",
					Reviewer:  2,
					AgentName: reviewer2Name,
					Content:   chunk,
				})
			}
		}
		review2 = o.executeReviewWithCallback(ctx, reviewer2, reviewerPrompt, "", outputCallback) // Empty code - use tools
		if callback != nil {
			callback(ProgressEvent{Type: "reviewer_done", Reviewer: 2, AgentName: reviewer2Name, Review: review2})
		}
	}()

	wg.Wait()

	// Check for errors in reviews
	if review1.Error != nil {
		return nil, fmt.Errorf("reviewer1 (%s) failed: %w", reviewer1Name, review1.Error)
	}
	if review2.Error != nil {
		return nil, fmt.Errorf("reviewer2 (%s) failed: %w", reviewer2Name, review2.Error)
	}

	totalDuration := time.Since(startTime)

	return &Result{
		Reviewer1:     reviewer1Name,
		Reviewer2:     reviewer2Name,
		Review1:       review1,
		Review2:       review2,
		TotalDuration: totalDuration,
	}, nil
}

// executeReview runs a single agent review
func (o *Orchestrator) executeReview(ctx context.Context, agent agents.Agent, prompt string, input string) *agents.Review {
	return o.executeReviewWithCallback(ctx, agent, prompt, input, nil)
}

// executeReviewWithCallback runs a single agent review with streaming support
func (o *Orchestrator) executeReviewWithCallback(ctx context.Context, agent agents.Agent, prompt string, input string, outputCallback agents.OutputCallback) *agents.Review {
	review := &agents.Review{
		AgentName: agent.Name(),
		StartTime: time.Now(),
	}

	fmt.Printf("⏳ Starting %s review...\n", agent.Name())

	// Check if agent supports streaming (has ExecuteWithCallback method)
	var output string
	var err error

	// Use type assertion to check if agent has ExecuteWithCallback
	switch a := agent.(type) {
	case *agents.ClaudeAgent:
		output, err = a.ExecuteWithCallback(ctx, prompt, input, outputCallback)
	case *agents.KilocodeAgent:
		output, err = a.ExecuteWithCallback(ctx, prompt, input, outputCallback)
	case *agents.CodexAgent:
		output, err = a.ExecuteWithCallback(ctx, prompt, input, outputCallback)
	default:
		// Fallback to regular Execute if streaming not supported
		output, err = agent.Execute(ctx, prompt, input)
	}

	review.EndTime = time.Now()
	review.Duration = review.EndTime.Sub(review.StartTime)

	if err != nil {
		review.Error = err
		fmt.Printf("❌ %s review failed after %v: %v\n", agent.Name(), review.Duration, err)
		return review
	}

	fmt.Printf("✓ %s review completed in %v (%d bytes)\n", agent.Name(), review.Duration, len(output))
	review.Content = output
	return review
}

// GetAvailableAgents returns a list of available agent names
func (o *Orchestrator) GetAvailableAgents() []string {
	available := []string{}
	for name, agent := range o.agents {
		if agent.IsAvailable() {
			available = append(available, name)
		}
	}
	return available
}

// GetAgent returns an agent by name
func (o *Orchestrator) GetAgent(name string) agents.Agent {
	return o.agents[name]
}
