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
	Reviewer1       string
	Reviewer2       string
	Aggregator      string
	Review1         *agents.Review
	Review2         *agents.Review
	AggregateReview *agents.Review
	TotalDuration   time.Duration
}

// RunReview orchestrates the complete review process
func (o *Orchestrator) RunReview(ctx context.Context, code string, userPrompt string, specifiedAgents []string) (*Result, error) {
	startTime := time.Now()

	// Get available agents
	available := o.cfg.GetEnabledAgents()

	// Select agents
	reviewer1Name, reviewer2Name, aggregatorName, err := SelectAgents(available, specifiedAgents)
	if err != nil {
		return nil, fmt.Errorf("failed to select agents: %w", err)
	}

	// Get agent instances
	reviewer1 := o.agents[reviewer1Name]
	reviewer2 := o.agents[reviewer2Name]
	aggregator := o.agents[aggregatorName]

	if reviewer1 == nil || reviewer2 == nil || aggregator == nil {
		return nil, fmt.Errorf("one or more selected agents not registered")
	}

	// Build reviewer prompts
	reviewerPrompt, err := BuildReviewerPrompt(
		o.cfg.Prompts.ReviewerTemplate,
		code,
		userPrompt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to build reviewer prompt: %w", err)
	}

	// Run two reviewers in parallel
	var wg sync.WaitGroup
	var review1, review2 *agents.Review

	wg.Add(2)

	// Reviewer 1
	go func() {
		defer wg.Done()
		review1 = o.executeReview(ctx, reviewer1, reviewerPrompt, code)
	}()

	// Reviewer 2
	go func() {
		defer wg.Done()
		review2 = o.executeReview(ctx, reviewer2, reviewerPrompt, code)
	}()

	wg.Wait()

	// Check for errors in reviews
	if review1.Error != nil {
		return nil, fmt.Errorf("reviewer1 (%s) failed: %w", reviewer1Name, review1.Error)
	}
	if review2.Error != nil {
		return nil, fmt.Errorf("reviewer2 (%s) failed: %w", reviewer2Name, review2.Error)
	}

	// Build aggregator prompt
	aggregatorPrompt, err := BuildAggregatorPrompt(
		o.cfg.Prompts.AggregatorTemplate,
		reviewer1Name,
		reviewer2Name,
		review1.Content,
		review2.Content,
		userPrompt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to build aggregator prompt: %w", err)
	}

	// Run aggregator
	aggregateReview := o.executeReview(ctx, aggregator, aggregatorPrompt, "")

	if aggregateReview.Error != nil {
		return nil, fmt.Errorf("aggregator (%s) failed: %w", aggregatorName, aggregateReview.Error)
	}

	totalDuration := time.Since(startTime)

	return &Result{
		Reviewer1:       reviewer1Name,
		Reviewer2:       reviewer2Name,
		Aggregator:      aggregatorName,
		Review1:         review1,
		Review2:         review2,
		AggregateReview: aggregateReview,
		TotalDuration:   totalDuration,
	}, nil
}

// executeReview runs a single agent review
func (o *Orchestrator) executeReview(ctx context.Context, agent agents.Agent, prompt string, input string) *agents.Review {
	review := &agents.Review{
		AgentName: agent.Name(),
		StartTime: time.Now(),
	}

	output, err := agent.Execute(ctx, prompt, input)
	review.EndTime = time.Now()
	review.Duration = review.EndTime.Sub(review.StartTime)

	if err != nil {
		review.Error = err
		return review
	}

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
