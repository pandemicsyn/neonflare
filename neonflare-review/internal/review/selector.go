package review

import (
	"fmt"
	"math/rand"
	"time"
)

func init() {
	// Seed random number generator
	rand.Seed(time.Now().UnixNano())
}

// SelectAgents selects 2 reviewers from available agents
// Prefers kilocode and claude over codex for better performance
// Returns (reviewer1, reviewer2, error)
func SelectAgents(available []string, userSpecified []string) (string, string, error) {
	// If user specified agents, validate and use them
	if len(userSpecified) > 0 {
		if len(userSpecified) != 2 {
			return "", "", fmt.Errorf("exactly 2 agents must be specified, got %d", len(userSpecified))
		}

		// Validate all specified agents are available
		for _, specified := range userSpecified {
			if !contains(available, specified) {
				return "", "", fmt.Errorf("specified agent not available: %s", specified)
			}
		}

		return userSpecified[0], userSpecified[1], nil
	}

	// Need at least 1 agent (can use same agent for both reviewers if needed)
	if len(available) < 1 {
		return "", "", fmt.Errorf("need at least 1 agent available")
	}

	// Preferred order: kilocode, claude, codex
	// This ensures we avoid codex (which is slow/hanging) when possible
	preferredOrder := []string{"kilocode", "claude", "codex"}

	// Build list of available agents in preferred order
	orderedAvailable := []string{}
	for _, preferred := range preferredOrder {
		if contains(available, preferred) {
			orderedAvailable = append(orderedAvailable, preferred)
		}
	}

	// Add any other agents not in the preferred list
	for _, agent := range available {
		if !contains(orderedAvailable, agent) {
			orderedAvailable = append(orderedAvailable, agent)
		}
	}

	// Select agents: use first 2 as reviewers
	// If we only have 1 agent available, use it for both reviewers
	if len(orderedAvailable) >= 2 {
		return orderedAvailable[0], orderedAvailable[1], nil
	} else {
		// Use same agent for both reviewers
		return orderedAvailable[0], orderedAvailable[0], nil
	}
}

// contains checks if a string is in a slice
func contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}
