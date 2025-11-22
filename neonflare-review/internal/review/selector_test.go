package review

import (
	"testing"
)

func TestSelectAgentsRandom(t *testing.T) {
	available := []string{"codex", "claude", "kilocode"}

	// Test random selection (no user-specified agents)
	r1, r2, agg, err := SelectAgents(available, nil)
	if err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}

	// All three should be different
	if r1 == r2 || r1 == agg || r2 == agg {
		t.Errorf("Expected all three agents to be different, got: %s, %s, %s", r1, r2, agg)
	}

	// All should be from available list
	agents := map[string]bool{r1: true, r2: true, agg: true}
	for agent := range agents {
		found := false
		for _, a := range available {
			if a == agent {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("Agent %s not in available list", agent)
		}
	}
}

func TestSelectAgentsUserSpecified(t *testing.T) {
	available := []string{"codex", "claude", "kilocode"}
	userSpecified := []string{"claude", "codex", "kilocode"}

	r1, r2, agg, err := SelectAgents(available, userSpecified)
	if err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}

	// Should match user specification exactly
	if r1 != "claude" || r2 != "codex" || agg != "kilocode" {
		t.Errorf("Expected claude, codex, kilocode; got %s, %s, %s", r1, r2, agg)
	}
}

func TestSelectAgentsInsufficientAgents(t *testing.T) {
	available := []string{"codex", "claude"} // Only 2 agents

	_, _, _, err := SelectAgents(available, nil)
	if err == nil {
		t.Error("Expected error with insufficient agents, got none")
	}
}

func TestSelectAgentsWrongNumberSpecified(t *testing.T) {
	available := []string{"codex", "claude", "kilocode"}

	tests := []struct {
		name          string
		userSpecified []string
		expectErr     bool
	}{
		{
			name:          "too few agents",
			userSpecified: []string{"codex", "claude"},
			expectErr:     true,
		},
		{
			name:          "too many agents",
			userSpecified: []string{"codex", "claude", "kilocode", "extra"},
			expectErr:     true,
		},
		{
			name:          "exactly 3 agents",
			userSpecified: []string{"codex", "claude", "kilocode"},
			expectErr:     false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, _, _, err := SelectAgents(available, tt.userSpecified)
			if tt.expectErr && err == nil {
				t.Error("Expected error but got none")
			}
			if !tt.expectErr && err != nil {
				t.Errorf("Expected no error but got: %v", err)
			}
		})
	}
}

func TestSelectAgentsUnavailableAgent(t *testing.T) {
	available := []string{"codex", "claude", "kilocode"}
	userSpecified := []string{"codex", "gpt5", "kilocode"} // gpt5 not available

	_, _, _, err := SelectAgents(available, userSpecified)
	if err == nil {
		t.Error("Expected error for unavailable agent, got none")
	}
}

func TestContains(t *testing.T) {
	slice := []string{"codex", "claude", "kilocode"}

	tests := []struct {
		item     string
		expected bool
	}{
		{"codex", true},
		{"claude", true},
		{"kilocode", true},
		{"gpt4", false},
		{"", false},
	}

	for _, tt := range tests {
		t.Run(tt.item, func(t *testing.T) {
			result := contains(slice, tt.item)
			if result != tt.expected {
				t.Errorf("contains(%s) = %v, expected %v", tt.item, result, tt.expected)
			}
		})
	}
}

func TestSelectAgentsRandomness(t *testing.T) {
	available := []string{"codex", "claude", "kilocode", "gpt4", "palm"}

	// Run selection multiple times and verify we get different results
	// (This is probabilistic, but with 5 agents, getting the same result
	// multiple times in a row is very unlikely)
	results := make(map[string]int)
	iterations := 100

	for i := 0; i < iterations; i++ {
		r1, r2, agg, err := SelectAgents(available, nil)
		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}

		// Create a unique key for this combination
		key := r1 + ":" + r2 + ":" + agg
		results[key]++
	}

	// We should have seen multiple different combinations
	if len(results) < 2 {
		t.Error("Expected random selection to produce multiple different combinations")
	}
}
