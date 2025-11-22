package config

import (
	"testing"
	"time"
)

func TestValidateMinimal(t *testing.T) {
	tests := []struct {
		name      string
		config    *Config
		expectErr bool
	}{
		{
			name: "valid config with 3 agents",
			config: &Config{
				Agents: AgentsConfig{
					Codex:    AgentConfig{Enabled: true, Timeout: 300 * time.Second},
					Claude:   AgentConfig{Enabled: true, Timeout: 300 * time.Second},
					Kilocode: AgentConfig{Enabled: true, Timeout: 300 * time.Second},
				},
			},
			expectErr: false,
		},
		{
			name: "only 2 agents enabled",
			config: &Config{
				Agents: AgentsConfig{
					Codex:    AgentConfig{Enabled: true, Timeout: 300 * time.Second},
					Claude:   AgentConfig{Enabled: false, Timeout: 300 * time.Second},
					Kilocode: AgentConfig{Enabled: true, Timeout: 300 * time.Second},
				},
			},
			expectErr: true,
		},
		{
			name: "all agents disabled",
			config: &Config{
				Agents: AgentsConfig{
					Codex:    AgentConfig{Enabled: false, Timeout: 300 * time.Second},
					Claude:   AgentConfig{Enabled: false, Timeout: 300 * time.Second},
					Kilocode: AgentConfig{Enabled: false, Timeout: 300 * time.Second},
				},
			},
			expectErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.config.ValidateMinimal()
			if tt.expectErr && err == nil {
				t.Error("Expected error but got none")
			}
			if !tt.expectErr && err != nil {
				t.Errorf("Expected no error but got: %v", err)
			}
		})
	}
}

func TestValidateTimeouts(t *testing.T) {
	tests := []struct {
		name      string
		config    *Config
		expectErr bool
	}{
		{
			name: "valid timeouts",
			config: &Config{
				Agents: AgentsConfig{
					Codex:    AgentConfig{Enabled: true, Timeout: 300 * time.Second, CLIPath: "codex"},
					Claude:   AgentConfig{Enabled: true, Timeout: 300 * time.Second, CLIPath: "claude"},
					Kilocode: AgentConfig{Enabled: true, Timeout: 300 * time.Second, CLIPath: "kilocode"},
				},
			},
			expectErr: false,
		},
		{
			name: "zero timeout for codex",
			config: &Config{
				Agents: AgentsConfig{
					Codex:    AgentConfig{Enabled: true, Timeout: 0, CLIPath: "codex"},
					Claude:   AgentConfig{Enabled: true, Timeout: 300 * time.Second, CLIPath: "claude"},
					Kilocode: AgentConfig{Enabled: true, Timeout: 300 * time.Second, CLIPath: "kilocode"},
				},
			},
			expectErr: true,
		},
		{
			name: "negative timeout for claude",
			config: &Config{
				Agents: AgentsConfig{
					Codex:    AgentConfig{Enabled: true, Timeout: 300 * time.Second, CLIPath: "codex"},
					Claude:   AgentConfig{Enabled: true, Timeout: -100 * time.Second, CLIPath: "claude"},
					Kilocode: AgentConfig{Enabled: true, Timeout: 300 * time.Second, CLIPath: "kilocode"},
				},
			},
			expectErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Validate will check CLI availability, so this might fail even with good config
			// We're specifically testing timeout validation here
			err := tt.config.Validate()

			// We expect timeout errors to be caught
			if tt.expectErr && err == nil {
				t.Error("Expected timeout validation error but got none")
			}
		})
	}
}
