package cmd

import (
	"context"
	"fmt"
	"os"
	"strings"

	"github.com/pandemicsyn/neonflare/neonflare-review/internal/agents"
	"github.com/pandemicsyn/neonflare/neonflare-review/internal/config"
	"github.com/pandemicsyn/neonflare/neonflare-review/internal/mining"
	"github.com/pandemicsyn/neonflare/neonflare-review/internal/review"
	"github.com/spf13/cobra"
)

var (
	// mine-rules flags
	mineRepo       string
	minePRs        int
	mineSince      string
	mineUpdate     bool
	mineAgent      string
	mineFocusAreas []string
)

var mineRulesCmd = &cobra.Command{
	Use:   "mine-rules",
	Short: "Mine PR comments to generate review rules",
	Long: `Mine PR comments to automatically generate review rules based on team feedback patterns.

This command uses the GitHub CLI (gh) to fetch PR comments from a repository,
then uses an AI agent to analyze the comments and extract common patterns that
can be used as automated review rules.

Examples:
  # Mine last 100 PRs from a repo
  neonflare-review mine-rules --repo owner/repo --prs 100

  # Focus on specific areas
  neonflare-review mine-rules --repo owner/repo --focus security,performance

  # Update existing rules with recent PRs
  neonflare-review mine-rules --repo owner/repo --prs 50 --update

  # Use specific agent
  neonflare-review mine-rules --repo owner/repo --agent kilocode

The generated rules are saved to:
  ~/.config/neonflare/reviewer-prompts/rules/team-rules-{repo}-{date}.md`,
	RunE: runMineRules,
}

func init() {
	// Add mine-rules subcommand to root
	rootCmd.AddCommand(mineRulesCmd)

	// Required flags
	mineRulesCmd.Flags().StringVar(&mineRepo, "repo", "", "repository to mine (e.g., owner/repo) [required]")
	mineRulesCmd.MarkFlagRequired("repo")

	// Optional flags
	mineRulesCmd.Flags().IntVar(&minePRs, "prs", 100, "number of recent PRs to analyze")
	mineRulesCmd.Flags().StringVar(&mineSince, "since", "", "only PRs merged after this date (e.g., '30 days ago', '2024-01-01')")
	mineRulesCmd.Flags().BoolVar(&mineUpdate, "update", false, "update existing rules file instead of creating new")
	mineRulesCmd.Flags().StringVar(&mineAgent, "agent", "claude", "agent to use for analysis (claude, kilocode, codex)")
	mineRulesCmd.Flags().StringSliceVar(&mineFocusAreas, "focus", []string{}, "specific areas to focus on (e.g., security,performance,style)")
}

func runMineRules(cmd *cobra.Command, args []string) error {
	// Load configuration
	cfg, err := config.Load(cfgFile)
	if err != nil {
		return fmt.Errorf("failed to load config: %w", err)
	}

	// Validate repository format
	if !strings.Contains(mineRepo, "/") {
		return fmt.Errorf("repository must be in format 'owner/repo'")
	}

	// Check if gh CLI is available
	if err := checkGHCLI(); err != nil {
		return err
	}

	fmt.Printf("🔍 Neonflare Review Rules Mining\n")
	fmt.Printf("   Repository: %s\n", mineRepo)
	fmt.Printf("   PRs to analyze: %d\n", minePRs)
	if mineSince != "" {
		fmt.Printf("   Since: %s\n", mineSince)
	}
	fmt.Printf("   Agent: %s\n", mineAgent)
	if len(mineFocusAreas) > 0 {
		fmt.Printf("   Focus areas: %s\n", strings.Join(mineFocusAreas, ", "))
	}
	if mineUpdate {
		fmt.Printf("   Mode: UPDATE existing rules\n")
	} else {
		fmt.Printf("   Mode: CREATE new rules\n")
	}
	fmt.Println()

	// Create orchestrator
	orch := review.NewOrchestrator(cfg)

	// Initialize and register agents using same pattern as root.go
	for _, agentName := range cfg.GetEnabledAgents() {
		agentCfg, err := cfg.GetAgentConfig(agentName)
		if err != nil {
			return fmt.Errorf("failed to get config for %s: %w", agentName, err)
		}

		var agent agents.Agent
		switch agentName {
		case "codex":
			agent = agents.NewCodexAgent(agents.Config{
				Name:    agentName,
				Model:   agentCfg.Model,
				Timeout: agentCfg.Timeout,
				CLIPath: agentCfg.CLIPath,
			})
		case "claude":
			agent = agents.NewClaudeAgent(agents.Config{
				Name:    agentName,
				Model:   agentCfg.Model,
				Timeout: agentCfg.Timeout,
				CLIPath: agentCfg.CLIPath,
			})
		case "kilocode":
			agent = agents.NewKilocodeAgent(agents.Config{
				Name:    agentName,
				Model:   agentCfg.Model,
				Timeout: agentCfg.Timeout,
				CLIPath: agentCfg.CLIPath,
			})
		}

		if agent != nil {
			orch.RegisterAgent(agent)
		}
	}

	// Validate agent selection
	agent := orch.GetAgent(mineAgent)
	if agent == nil {
		return fmt.Errorf("unknown agent: %s (available: claude, kilocode, codex)", mineAgent)
	}
	if !agent.IsAvailable() {
		return fmt.Errorf("agent %s is not available (check API keys in config)", mineAgent)
	}

	// Handle update mode: find existing rules file
	var existingRules string
	if mineUpdate {
		homeDir, err := os.UserHomeDir()
		if err != nil {
			return fmt.Errorf("failed to get home directory: %w", err)
		}
		configDir := os.Getenv("NEONFLARE_CONFIG_DIR")
		if configDir == "" {
			configDir = fmt.Sprintf("%s/.config/neonflare", homeDir)
		}

		existingFiles, err := mining.FindExistingRules(configDir, mineRepo)
		if err != nil {
			return fmt.Errorf("failed to find existing rules: %w", err)
		}

		if len(existingFiles) == 0 {
			fmt.Println("⚠️  No existing rules found for this repository. Creating new rules file instead.")
			mineUpdate = false
		} else {
			// Use the most recent file (last in list)
			latestFile := existingFiles[len(existingFiles)-1]
			fmt.Printf("📄 Found existing rules: %s\n", latestFile)
			fmt.Println("   Will update this file with new patterns.\n")

			existingRules, err = mining.LoadRulesFile(latestFile)
			if err != nil {
				return fmt.Errorf("failed to load existing rules: %w", err)
			}
		}
	}

	// Build mining prompt
	promptConfig := mining.PromptConfig{
		Repository:    mineRepo,
		PRCount:       minePRs,
		Since:         mineSince,
		Update:        mineUpdate,
		ExistingRules: existingRules,
		FocusAreas:    mineFocusAreas,
	}

	prompt := mining.BuildMiningPrompt(promptConfig)

	// Create progress callback for streaming output
	progressCallback := func(chunk string) {
		// Print chunks as they come in
		fmt.Print(chunk)
	}

	// Run the mining operation with timeout
	ctx := context.Background()

	// Get the agent's timeout
	agentCfg, err := cfg.GetAgentConfig(mineAgent)
	if err == nil && agentCfg.Timeout > 0 {
		var cancel context.CancelFunc
		ctx, cancel = context.WithTimeout(ctx, agentCfg.Timeout)
		defer cancel()
	}

	result, err := mining.RunMining(ctx, orch, mineAgent, prompt, progressCallback)
	if err != nil {
		return fmt.Errorf("mining failed: %w", err)
	}

	// Save the result
	homeDir, _ := os.UserHomeDir()
	configDir := os.Getenv("NEONFLARE_CONFIG_DIR")
	if configDir == "" {
		configDir = fmt.Sprintf("%s/.config/neonflare", homeDir)
	}

	saverConfig := mining.SaverConfig{
		ConfigDir:  configDir,
		Repository: mineRepo,
		AgentName:  mineAgent,
		UpdateMode: mineUpdate,
	}

	result.Repository = mineRepo
	result.PRCount = minePRs

	outputPath, err := mining.SaveMiningResult(result, saverConfig)
	if err != nil {
		return fmt.Errorf("failed to save results: %w", err)
	}

	fmt.Printf("\n✅ Rules saved to: %s\n", outputPath)
	fmt.Printf("\n💡 To use these rules in a review:\n")
	fmt.Printf("   neonflare-review --profile %s\n", extractProfileName(outputPath))

	return nil
}

// checkGHCLI verifies that the GitHub CLI is installed
func checkGHCLI() error {
	// Try to run gh --version
	if _, err := os.Stat("/usr/bin/gh"); err == nil {
		return nil
	}
	if _, err := os.Stat("/usr/local/bin/gh"); err == nil {
		return nil
	}

	// Check PATH
	path := os.Getenv("PATH")
	for _, dir := range strings.Split(path, ":") {
		ghPath := fmt.Sprintf("%s/gh", dir)
		if _, err := os.Stat(ghPath); err == nil {
			return nil
		}
	}

	return fmt.Errorf("GitHub CLI (gh) not found. Please install it: https://cli.github.com/")
}

// extractProfileName gets the profile name from a file path
func extractProfileName(path string) string {
	// Extract filename from path
	parts := strings.Split(path, "/")
	filename := parts[len(parts)-1]
	// Remove .md extension
	return strings.TrimSuffix(filename, ".md")
}
