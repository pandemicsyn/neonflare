package config

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestLoadDefaultConfig(t *testing.T) {
	// Create a temporary directory
	tmpDir := t.TempDir()
	originalDir, _ := os.Getwd()
	defer os.Chdir(originalDir)

	// Change to temp directory
	if err := os.Chdir(tmpDir); err != nil {
		t.Fatalf("Failed to change directory: %v", err)
	}

	// Load config (should use defaults since no file exists)
	cfg, err := Load("")
	if err != nil {
		t.Fatalf("Expected no error with defaults, got: %v", err)
	}

	// Verify defaults
	if !cfg.Agents.Codex.Enabled {
		t.Error("Expected codex to be enabled by default")
	}
	if cfg.Agents.Codex.Model != "gpt-4" {
		t.Errorf("Expected default codex model 'gpt-4', got '%s'", cfg.Agents.Codex.Model)
	}
	if cfg.Agents.Codex.Timeout != 300*time.Second {
		t.Errorf("Expected default timeout 300s, got %v", cfg.Agents.Codex.Timeout)
	}
	if cfg.Output.Dir != ".neonflare-reviews" {
		t.Errorf("Expected default output dir '.neonflare-reviews', got '%s'", cfg.Output.Dir)
	}
}

func TestLoadConfigFromFile(t *testing.T) {
	// Create a temporary directory
	tmpDir := t.TempDir()
	configPath := filepath.Join(tmpDir, ".neonflare.yaml")

	// Write a test config file
	configContent := `
agents:
  codex:
    enabled: true
    model: "gpt-3.5-turbo"
    timeout: 60s
    cli_path: "/usr/local/bin/codex"
  claude:
    enabled: false
    model: "claude-opus-4"
    timeout: 120s
    cli_path: "claude"
  kilocode:
    enabled: true
    model: "custom"
    timeout: 180s
    cli_path: "kilocode"
output:
  dir: "custom-reviews"
  timestamp: false
prompts:
  reviewer_template: "custom/reviewer.txt"
  aggregator_template: "custom/aggregator.txt"
`
	if err := os.WriteFile(configPath, []byte(configContent), 0644); err != nil {
		t.Fatalf("Failed to write config file: %v", err)
	}

	// Load the config
	cfg, err := Load(configPath)
	if err != nil {
		t.Fatalf("Failed to load config: %v", err)
	}

	// Verify loaded values
	if cfg.Agents.Codex.Model != "gpt-3.5-turbo" {
		t.Errorf("Expected model 'gpt-3.5-turbo', got '%s'", cfg.Agents.Codex.Model)
	}
	if cfg.Agents.Codex.Timeout != 60*time.Second {
		t.Errorf("Expected timeout 60s, got %v", cfg.Agents.Codex.Timeout)
	}
	if cfg.Agents.Claude.Enabled {
		t.Error("Expected claude to be disabled")
	}
	if cfg.Output.Dir != "custom-reviews" {
		t.Errorf("Expected output dir 'custom-reviews', got '%s'", cfg.Output.Dir)
	}
	if cfg.Output.Timestamp {
		t.Error("Expected timestamp to be false")
	}
}

func TestGetEnabledAgents(t *testing.T) {
	cfg := &Config{
		Agents: AgentsConfig{
			Codex:    AgentConfig{Enabled: true},
			Claude:   AgentConfig{Enabled: false},
			Kilocode: AgentConfig{Enabled: true},
		},
	}

	enabled := cfg.GetEnabledAgents()

	if len(enabled) != 2 {
		t.Errorf("Expected 2 enabled agents, got %d", len(enabled))
	}

	expectedAgents := map[string]bool{"codex": true, "kilocode": true}
	for _, agent := range enabled {
		if !expectedAgents[agent] {
			t.Errorf("Unexpected enabled agent: %s", agent)
		}
	}
}

func TestGetAgentConfig(t *testing.T) {
	cfg := &Config{
		Agents: AgentsConfig{
			Codex: AgentConfig{
				Enabled: true,
				Model:   "gpt-4",
				Timeout: 300 * time.Second,
				CLIPath: "codex",
			},
		},
	}

	// Test valid agent
	agentCfg, err := cfg.GetAgentConfig("codex")
	if err != nil {
		t.Errorf("Expected no error for valid agent, got: %v", err)
	}
	if agentCfg.Model != "gpt-4" {
		t.Errorf("Expected model 'gpt-4', got '%s'", agentCfg.Model)
	}

	// Test invalid agent
	_, err = cfg.GetAgentConfig("invalid")
	if err == nil {
		t.Error("Expected error for invalid agent")
	}
}

func TestEnsureOutputDir(t *testing.T) {
	tmpDir := t.TempDir()
	cfg := &Config{
		Output: OutputConfig{
			Dir: filepath.Join(tmpDir, "test-reviews"),
		},
	}

	// Directory should not exist yet
	if _, err := os.Stat(cfg.Output.Dir); !os.IsNotExist(err) {
		t.Error("Expected directory to not exist initially")
	}

	// Create the directory
	if err := cfg.EnsureOutputDir(); err != nil {
		t.Errorf("Failed to create output directory: %v", err)
	}

	// Verify directory exists
	if stat, err := os.Stat(cfg.Output.Dir); err != nil || !stat.IsDir() {
		t.Error("Expected directory to exist after EnsureOutputDir")
	}
}
