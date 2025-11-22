package config

import (
	"fmt"
	"os/exec"
)

// Validate checks if the configuration is valid
func (c *Config) Validate() error {
	// Check if at least one agent is enabled
	enabled := c.GetEnabledAgents()
	if len(enabled) < 3 {
		return fmt.Errorf("at least 3 agents must be enabled for multi-agent review")
	}

	// Check if agent CLIs are available
	for _, agentName := range enabled {
		agentCfg, err := c.GetAgentConfig(agentName)
		if err != nil {
			return err
		}

		if !isCommandAvailable(agentCfg.CLIPath) {
			return fmt.Errorf("agent CLI not found: %s (path: %s)", agentName, agentCfg.CLIPath)
		}
	}

	// Validate timeout values
	if c.Agents.Codex.Timeout <= 0 {
		return fmt.Errorf("codex timeout must be positive")
	}
	if c.Agents.Claude.Timeout <= 0 {
		return fmt.Errorf("claude timeout must be positive")
	}
	if c.Agents.Kilocode.Timeout <= 0 {
		return fmt.Errorf("kilocode timeout must be positive")
	}

	return nil
}

// isCommandAvailable checks if a command is available in PATH or as an absolute path
func isCommandAvailable(cmd string) bool {
	_, err := exec.LookPath(cmd)
	return err == nil
}

// ValidateMinimal performs minimal validation without checking CLI availability
// This is useful for initial setup when agents might not be installed yet
func (c *Config) ValidateMinimal() error {
	enabled := c.GetEnabledAgents()
	if len(enabled) < 3 {
		return fmt.Errorf("at least 3 agents must be enabled for multi-agent review")
	}
	return nil
}
