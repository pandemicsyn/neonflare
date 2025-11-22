package output

import (
	"fmt"
	"strings"

	"github.com/pandemicsyn/neonflare/neonflare-review/internal/agents"
)

// FormatReviewSummary creates a brief summary of a review for display
func FormatReviewSummary(review *agents.Review) string {
	var sb strings.Builder

	sb.WriteString(fmt.Sprintf("Agent: %s\n", review.AgentName))
	sb.WriteString(fmt.Sprintf("Duration: %v\n", review.Duration))

	if review.Error != nil {
		sb.WriteString(fmt.Sprintf("Status: ❌ Failed - %v\n", review.Error))
	} else {
		sb.WriteString("Status: ✅ Complete\n")

		// Show first few lines of content
		lines := strings.Split(review.Content, "\n")
		preview := 5
		if len(lines) < preview {
			preview = len(lines)
		}

		sb.WriteString("\nPreview:\n")
		for i := 0; i < preview; i++ {
			sb.WriteString(fmt.Sprintf("  %s\n", lines[i]))
		}

		if len(lines) > preview {
			sb.WriteString(fmt.Sprintf("  ... (%d more lines)\n", len(lines)-preview))
		}
	}

	return sb.String()
}

// FormatResults creates a formatted summary of all review results
func FormatResults(reviewer1Name, reviewer2Name string,
	review1, review2 *agents.Review, totalDuration string) string {

	var sb strings.Builder

	sb.WriteString("\n" + strings.Repeat("=", 70) + "\n")
	sb.WriteString("                   NEONFLARE REVIEW COMPLETE\n")
	sb.WriteString(strings.Repeat("=", 70) + "\n\n")

	sb.WriteString(fmt.Sprintf("Total Duration: %s\n\n", totalDuration))

	sb.WriteString("Reviewers:\n")
	sb.WriteString(fmt.Sprintf("  1. %s (%v)\n", reviewer1Name, review1.Duration))
	sb.WriteString(fmt.Sprintf("  2. %s (%v)\n\n", reviewer2Name, review2.Duration))

	return sb.String()
}
