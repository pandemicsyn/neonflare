package cmd

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

var (
	cfgFile string

	// Global flags
	agents      []string
	outputDir   string
	autoMode    bool
	userPrompt  string
)

var rootCmd = &cobra.Command{
	Use:   "neonflare-review [path|--stdin]",
	Short: "Multi-agent code review tool",
	Long: `Neonflare Review orchestrates multiple AI agents (codex, Claude, kilocode)
to perform collaborative code reviews. Two randomly selected agents perform
initial reviews, and a third agent aggregates and vets the results.`,
	Version: "0.1.0",
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
	rootCmd.Flags().StringSliceVar(&agents, "agents", []string{}, "specify agents to use (e.g., codex,claude,kilocode)")
	rootCmd.Flags().StringVar(&outputDir, "output-dir", "", "directory to save review files")

	// Mode flags
	rootCmd.Flags().BoolVar(&autoMode, "auto", false, "run in one-shot mode with split-screen UI")
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
	// TODO: Implement review orchestration
	fmt.Println("🔍 Neonflare Review v0.1.0")
	fmt.Println("Review functionality coming soon...")

	// Placeholder for now
	if len(args) > 0 {
		fmt.Printf("Would review: %s\n", args[0])
	}

	return nil
}
