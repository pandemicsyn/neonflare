package cmd

import (
	"context"
	"fmt"
	"os"

	"github.com/pandemicsyn/neonflare/neonflare-review/internal/agents"
	"github.com/pandemicsyn/neonflare/neonflare-review/internal/config"
	"github.com/pandemicsyn/neonflare/neonflare-review/internal/input"
	"github.com/pandemicsyn/neonflare/neonflare-review/internal/logging"
	"github.com/pandemicsyn/neonflare/neonflare-review/internal/output"
	"github.com/pandemicsyn/neonflare/neonflare-review/internal/review"
	"github.com/pandemicsyn/neonflare/neonflare-review/internal/ui"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

var (
	cfgFile string

	// Global flags
	agentsList      []string
	outputDir       string
	autoMode        bool
	interactiveMode bool
	userPrompt      string
)

var rootCmd = &cobra.Command{
	Use:   "neonflare-review [path|--stdin]",
	Short: "Multi-agent code review tool",
	Long: `Neonflare Review orchestrates multiple AI agents (codex, Claude, kilocode)
to perform collaborative code reviews. Two randomly selected agents perform
initial reviews, and a third agent aggregates and vets the results.`,
	Version: "0.1.0",
	Args:    cobra.MaximumNArgs(1), // Accept 0 or 1 positional argument (the path)
	RunE:    runReview,
}

func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func init() {
	cobra.OnInitialize(initConfig)

	// Config file flag
	rootCmd.PersistentFlags().StringVar(&cfgFile, "config", "", "config file (default is .neonflare.yaml)")

	// Agent selection flags
	rootCmd.Flags().StringSliceVar(&agentsList, "agents", []string{}, "specify agents to use (e.g., codex,claude,kilocode)")
	rootCmd.Flags().StringVar(&outputDir, "output-dir", "", "directory to save review files")

	// Mode flags
	rootCmd.Flags().BoolVar(&autoMode, "auto", false, "run in one-shot mode with split-screen UI")
	rootCmd.Flags().BoolVar(&interactiveMode, "interactive", false, "run in fully interactive mode with guided workflow")
	rootCmd.Flags().Bool("stdin", false, "read code from stdin instead of git repo")

	// Review options
	rootCmd.Flags().StringVar(&userPrompt, "prompt", "", "additional instructions for reviewers")
	rootCmd.Flags().Bool("staged", false, "review staged changes only")
	rootCmd.Flags().String("commit", "", "review specific commit")

	// Model overrides
	rootCmd.Flags().String("model-codex", "", "override model for codex")
	rootCmd.Flags().String("model-claude", "", "override model for Claude")
	rootCmd.Flags().String("model-kilocode", "", "override model for kilocode")

	// Timeout
	rootCmd.Flags().Duration("timeout", 0, "override default timeout for agents")
}

func initConfig() {
	if cfgFile != "" {
		// Use config file from the flag
		viper.SetConfigFile(cfgFile)
	} else {
		// Search for config in current directory
		viper.AddConfigPath(".")
		viper.SetConfigType("yaml")
		viper.SetConfigName(".neonflare")
	}

	viper.AutomaticEnv()

	// Read config file if it exists
	if err := viper.ReadInConfig(); err == nil {
		fmt.Fprintln(os.Stderr, "Using config file:", viper.ConfigFileUsed())
	}
}

func runReview(cmd *cobra.Command, args []string) error {
	fmt.Println("🔍 Neonflare Review v0.1.0")

	// Load configuration
	cfg, err := config.Load(cfgFile)
	if err != nil {
		return fmt.Errorf("failed to load config: %w", err)
	}

	// Initialize logging
	logDir := cfg.Output.Dir
	if logDir == "" {
		logDir = ".neonflare-reviews"
	}
	if err := logging.Init(logDir); err != nil {
		fmt.Fprintf(os.Stderr, "Warning: failed to initialize logging: %v\n", err)
	} else {
		defer logging.Close()
	}

	logging.Info("Neonflare Review v0.1.0 started")
	logging.Info("Config file: %s", cfgFile)

	// Override config with CLI flags
	applyConfigOverrides(cmd, cfg)

	// Validate configuration (minimal validation - don't check CLI availability yet)
	if err := cfg.ValidateMinimal(); err != nil {
		return fmt.Errorf("invalid configuration: %w", err)
	}

	// Get input code
	code, metadata, err := getInputCode(cmd, args)
	if err != nil {
		return err
	}

	fmt.Printf("Input: %d bytes\n", len(code))
	if len(metadata) > 0 {
		fmt.Println("Metadata:")
		for k, v := range metadata {
			fmt.Printf("  %s: %s\n", k, v)
		}
	}
	fmt.Println()

	// Create orchestrator
	orch := review.NewOrchestrator(cfg)

	// Register agents
	if err := registerAgents(orch, cfg); err != nil {
		return err
	}

	// Validate that required agent CLIs are available
	available := orch.GetAvailableAgents()
	if len(available) == 0 {
		return fmt.Errorf("no agent CLIs are available - please install at least one of: codex, claude, kilocode")
	}
	if len(available) < 3 {
		fmt.Printf("⚠️  Warning: Only %d agent(s) available: %v\n", len(available), available)
		fmt.Println("⚠️  Multi-agent review requires 3 agents. Some may be unavailable:")
		for _, agent := range []string{"codex", "claude", "kilocode"} {
			if !stringInSlice(agent, available) {
				fmt.Printf("   - %s: not found\n", agent)
			}
		}
		fmt.Println()
	}
	fmt.Printf("Available agents: %v\n\n", available)

	// Get user-specified agents (if any)
	var specifiedAgents []string
	if len(agentsList) > 0 {
		specifiedAgents = agentsList
		fmt.Printf("Using specified agents: %v\n", specifiedAgents)
	} else {
		fmt.Println("Randomly selecting from available agents...")
	}

	// Run the review with or without UI
	var result *review.Result
	ctx := context.Background()

	if interactiveMode {
		// Use fully interactive mode with guided workflow
		fmt.Println("Starting interactive mode...")
		fmt.Println() // Clear line before UI starts

		err = ui.RunInteractive(ctx, cfg, orch, code, userPrompt, metadata)
		if err != nil {
			return fmt.Errorf("interactive mode failed: %w", err)
		}
		// Interactive mode handles everything including file output and display
		return nil
	} else if autoMode {
		// Use Bubbletea UI for auto mode
		fmt.Println("Starting review with interactive UI...")
		fmt.Println() // Clear line before UI starts

		result, err = ui.RunWithUI(ctx, orch, code, userPrompt, specifiedAgents, cfg, metadata)
		if err != nil {
			return fmt.Errorf("review failed: %w", err)
		}
	} else {
		// Use console output for non-auto mode
		fmt.Println("Starting review process...")

		result, err = orch.RunReview(ctx, code, userPrompt, specifiedAgents)
		if err != nil {
			return fmt.Errorf("review failed: %w", err)
		}

		// Display summary for console mode
		fmt.Println(output.FormatResults(
			result.Reviewer1,
			result.Reviewer2,
			result.Aggregator,
			result.Review1,
			result.Review2,
			result.AggregateReview,
			result.TotalDuration.String(),
		))
	}

	// Save reviews to files
	writer := output.NewWriter(cfg.Output.Dir, cfg.Output.Timestamp)

	file1, err := writer.SaveReview(result.Review1, metadata)
	if err != nil {
		return fmt.Errorf("failed to save review 1: %w", err)
	}
	fmt.Printf("Saved %s review to: %s\n", result.Reviewer1, file1)

	file2, err := writer.SaveReview(result.Review2, metadata)
	if err != nil {
		return fmt.Errorf("failed to save review 2: %w", err)
	}
	fmt.Printf("Saved %s review to: %s\n", result.Reviewer2, file2)

	fileAgg, err := writer.SaveAggregateReview(result.AggregateReview, metadata, result.Reviewer1, result.Reviewer2)
	if err != nil {
		return fmt.Errorf("failed to save aggregate review: %w", err)
	}
	fmt.Printf("Saved aggregate review to: %s\n\n", fileAgg)

	// Display the aggregate review
	fmt.Println(result.AggregateReview.Content)

	return nil
}

// getInputCode retrieves the code to review based on flags and arguments
func getInputCode(cmd *cobra.Command, args []string) (string, map[string]string, error) {
	metadata := make(map[string]string)

	useStdin, _ := cmd.Flags().GetBool("stdin")

	if useStdin {
		// Read from stdin
		fmt.Println("Reading from stdin...")
		code, err := input.ReadFromStdin()
		if err != nil {
			return "", nil, fmt.Errorf("failed to read from stdin: %w", err)
		}
		metadata["source"] = "stdin"
		return code, metadata, nil
	}

	// Read from git repository
	repoPath := "."
	if len(args) > 0 {
		repoPath = args[0]
	}
	staged, _ := cmd.Flags().GetBool("staged")
	commit, _ := cmd.Flags().GetString("commit")

	opts := input.GitOptions{
		RepoPath: repoPath,
		Staged:   staged,
		Commit:   commit,
	}

	code, err := input.ReadFromGit(opts)
	if err != nil {
		return "", nil, fmt.Errorf("failed to read from git: %w", err)
	}

	// Get repo info for metadata
	if info, err := input.GetRepoInfo(repoPath); err == nil {
		for k, v := range info {
			metadata[k] = v
		}
	}
	metadata["source"] = "git"
	metadata["repository"] = repoPath

	return code, metadata, nil
}

// registerAgents creates and registers agent instances with the orchestrator
func registerAgents(orch *review.Orchestrator, cfg *config.Config) error {
	// Register all enabled agents
	for _, agentName := range cfg.GetEnabledAgents() {
		agentCfg, err := cfg.GetAgentConfig(agentName)
		if err != nil {
			return err
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
		default:
			return fmt.Errorf("unknown agent: %s", agentName)
		}

		orch.RegisterAgent(agent)
	}

	return nil
}

// applyConfigOverrides applies CLI flag overrides to the configuration
func applyConfigOverrides(cmd *cobra.Command, cfg *config.Config) {
	// Output directory override
	if outputDir != "" {
		cfg.Output.Dir = outputDir
	}

	// Model overrides
	if modelCodex, _ := cmd.Flags().GetString("model-codex"); modelCodex != "" {
		cfg.Agents.Codex.Model = modelCodex
	}
	if modelClaude, _ := cmd.Flags().GetString("model-claude"); modelClaude != "" {
		cfg.Agents.Claude.Model = modelClaude
	}
	if modelKilocode, _ := cmd.Flags().GetString("model-kilocode"); modelKilocode != "" {
		cfg.Agents.Kilocode.Model = modelKilocode
	}

	// Timeout override
	if timeout, _ := cmd.Flags().GetDuration("timeout"); timeout > 0 {
		cfg.Agents.Codex.Timeout = timeout
		cfg.Agents.Claude.Timeout = timeout
		cfg.Agents.Kilocode.Timeout = timeout
	}
}

// stringInSlice checks if a string is in a slice
func stringInSlice(str string, slice []string) bool {
	for _, s := range slice {
		if s == str {
			return true
		}
	}
	return false
}
