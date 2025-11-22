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

// SelectAgents randomly selects 2 reviewers and 1 aggregator from available agents
// Returns (reviewer1, reviewer2, aggregator, error)
func SelectAgents(available []string, userSpecified []string) (string, string, string, error) {
	// If user specified agents, validate and use them
	if len(userSpecified) > 0 {
		if len(userSpecified) != 3 {
			return "", "", "", fmt.Errorf("exactly 3 agents must be specified, got %d", len(userSpecified))
		}

		// Validate all specified agents are available
		for _, specified := range userSpecified {
			if !contains(available, specified) {
				return "", "", "", fmt.Errorf("specified agent not available: %s", specified)
			}
		}

		return userSpecified[0], userSpecified[1], userSpecified[2], nil
	}

	// Random selection
	if len(available) < 3 {
		return "", "", "", fmt.Errorf("need at least 3 agents, but only %d are available", len(available))
	}

	// Shuffle and take first 3
	shuffled := make([]string, len(available))
	copy(shuffled, available)
	rand.Shuffle(len(shuffled), func(i, j int) {
		shuffled[i], shuffled[j] = shuffled[j], shuffled[i]
	})

	return shuffled[0], shuffled[1], shuffled[2], nil
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
