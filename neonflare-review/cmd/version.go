package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
)

var versionCmd = &cobra.Command{
	Use:   "version",
	Short: "Print the version number",
	Long:  `Display the version information for neonflare-review`,
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Println("neonflare-review v0.1.0")
	},
}

func init() {
	rootCmd.AddCommand(versionCmd)
}
