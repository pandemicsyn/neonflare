package config

import (
	"fmt"
	"os"
	"time"

	"github.com/spf13/viper"
)

// Config represents the complete configuration for neonflare-review
type Config struct {
	Agents  AgentsConfig  `mapstructure:"agents"`
	Output  OutputConfig  `mapstructure:"output"`
	Prompts PromptsConfig `mapstructure:"prompts"`
}

// AgentsConfig contains configuration for all agents
type AgentsConfig struct {
	Codex    AgentConfig `mapstructure:"codex"`
	Claude   AgentConfig `mapstructure:"claude"`
	Kilocode AgentConfig `mapstructure:"kilocode"`
}

// AgentConfig represents configuration for a single agent
type AgentConfig struct {
	Enabled bool          `mapstructure:"enabled"`
	Model   string        `mapstructure:"model"`
	Timeout time.Duration `mapstructure:"timeout"`
	CLIPath string        `mapstructure:"cli_path"`
}

// OutputConfig contains output-related settings
type OutputConfig struct {
	Dir       string `mapstructure:"dir"`
	Timestamp bool   `mapstructure:"timestamp"`
}

// PromptsConfig contains paths to prompt templates
type PromptsConfig struct {
	ReviewerTemplate   string `mapstructure:"reviewer_template"`
	AggregatorTemplate string `mapstructure:"aggregator_template"`
}

// Load reads and parses the configuration file
func Load(configFile string) (*Config, error) {
	v := viper.New()

	if configFile != "" {
		v.SetConfigFile(configFile)
	} else {
		v.AddConfigPath(".")
		v.SetConfigType("yaml")
		v.SetConfigName(".neonflare")
	}

	// Set defaults
	setDefaults(v)

	// Read config file
	if err := v.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			return nil, fmt.Errorf("failed to read config file: %w", err)
		}
		// Config file not found; use defaults
	}

	var cfg Config
	if err := v.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config: %w", err)
	}

	return &cfg, nil
}

// setDefaults sets default configuration values
func setDefaults(v *viper.Viper) {
	// Codex defaults
	v.SetDefault("agents.codex.enabled", true)
	v.SetDefault("agents.codex.model", "gpt-4")
	v.SetDefault("agents.codex.timeout", 300*time.Second)
	v.SetDefault("agents.codex.cli_path", "codex")

	// Claude defaults
	v.SetDefault("agents.claude.enabled", true)
	v.SetDefault("agents.claude.model", "claude-sonnet-4")
	v.SetDefault("agents.claude.timeout", 300*time.Second)
	v.SetDefault("agents.claude.cli_path", "claude")

	// Kilocode defaults
	v.SetDefault("agents.kilocode.enabled", true)
	v.SetDefault("agents.kilocode.model", "default")
	v.SetDefault("agents.kilocode.timeout", 300*time.Second)
	v.SetDefault("agents.kilocode.cli_path", "kilocode")

	// Output defaults
	v.SetDefault("output.dir", ".neonflare-reviews")
	v.SetDefault("output.timestamp", true)

	// Prompt defaults
	v.SetDefault("prompts.reviewer_template", "prompts/reviewer.txt")
	v.SetDefault("prompts.aggregator_template", "prompts/aggregator.txt")
}

// GetEnabledAgents returns a list of agent names that are enabled
func (c *Config) GetEnabledAgents() []string {
	var enabled []string

	if c.Agents.Codex.Enabled {
		enabled = append(enabled, "codex")
	}
	if c.Agents.Claude.Enabled {
		enabled = append(enabled, "claude")
	}
	if c.Agents.Kilocode.Enabled {
		enabled = append(enabled, "kilocode")
	}

	return enabled
}

// GetAgentConfig returns the configuration for a specific agent by name
func (c *Config) GetAgentConfig(name string) (AgentConfig, error) {
	switch name {
	case "codex":
		return c.Agents.Codex, nil
	case "claude":
		return c.Agents.Claude, nil
	case "kilocode":
		return c.Agents.Kilocode, nil
	default:
		return AgentConfig{}, fmt.Errorf("unknown agent: %s", name)
	}
}

// EnsureOutputDir creates the output directory if it doesn't exist
func (c *Config) EnsureOutputDir() error {
	if err := os.MkdirAll(c.Output.Dir, 0755); err != nil {
		return fmt.Errorf("failed to create output directory: %w", err)
	}
	return nil
}
