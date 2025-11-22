package output

import (
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/pandemicsyn/neonflare/neonflare-review/internal/agents"
)

// Writer handles saving review results to files
type Writer struct {
	outputDir    string
	useTimestamp bool
}

// NewWriter creates a new output writer
func NewWriter(outputDir string, useTimestamp bool) *Writer {
	return &Writer{
		outputDir:    outputDir,
		useTimestamp: useTimestamp,
	}
}

// SaveReview saves a single review to a markdown file
func (w *Writer) SaveReview(review *agents.Review, metadata map[string]string) (string, error) {
	// Ensure output directory exists
	if err := os.MkdirAll(w.outputDir, 0755); err != nil {
		return "", fmt.Errorf("failed to create output directory: %w", err)
	}

	// Generate filename
	filename := w.generateFilename(review.AgentName, "review")
	filepath := filepath.Join(w.outputDir, filename)

	// Build file content
	content := w.buildReviewContent(review, metadata)

	// Write to file
	if err := os.WriteFile(filepath, []byte(content), 0644); err != nil {
		return "", fmt.Errorf("failed to write review file: %w", err)
	}

	return filepath, nil
}

// SaveAggregateReview saves the final aggregated review
func (w *Writer) SaveAggregateReview(review *agents.Review, metadata map[string]string, reviewer1, reviewer2 string) (string, error) {
	// Ensure output directory exists
	if err := os.MkdirAll(w.outputDir, 0755); err != nil {
		return "", fmt.Errorf("failed to create output directory: %w", err)
	}

	// Generate filename
	filename := w.generateFilename("aggregate", "review")
	filepath := filepath.Join(w.outputDir, filename)

	// Build file content with additional context
	content := w.buildAggregateContent(review, metadata, reviewer1, reviewer2)

	// Write to file
	if err := os.WriteFile(filepath, []byte(content), 0644); err != nil {
		return "", fmt.Errorf("failed to write aggregate review file: %w", err)
	}

	return filepath, nil
}

// generateFilename creates a filename with optional timestamp
func (w *Writer) generateFilename(agentName, suffix string) string {
	if w.useTimestamp {
		timestamp := time.Now().Format("2006-01-02_150405")
		return fmt.Sprintf("%s_%s_%s.md", timestamp, agentName, suffix)
	}
	return fmt.Sprintf("%s_%s.md", agentName, suffix)
}

// buildReviewContent creates the markdown content for a review
func (w *Writer) buildReviewContent(review *agents.Review, metadata map[string]string) string {
	content := fmt.Sprintf("# Code Review by %s\n\n", review.AgentName)

	// Add metadata
	content += "## Metadata\n\n"
	content += fmt.Sprintf("- **Agent**: %s\n", review.AgentName)
	content += fmt.Sprintf("- **Model**: %s\n", review.Model)
	content += fmt.Sprintf("- **Timestamp**: %s\n", review.StartTime.Format(time.RFC3339))
	content += fmt.Sprintf("- **Duration**: %v\n", review.Duration)

	// Add custom metadata
	for key, value := range metadata {
		content += fmt.Sprintf("- **%s**: %s\n", key, value)
	}

	content += "\n## Review\n\n"
	content += review.Content
	content += "\n"

	return content
}

// buildAggregateContent creates the markdown content for an aggregate review
func (w *Writer) buildAggregateContent(review *agents.Review, metadata map[string]string, reviewer1, reviewer2 string) string {
	content := "# Aggregate Code Review\n\n"

	// Add metadata
	content += "## Metadata\n\n"
	content += fmt.Sprintf("- **Aggregator**: %s\n", review.AgentName)
	content += fmt.Sprintf("- **Model**: %s\n", review.Model)
	content += fmt.Sprintf("- **Reviewers**: %s, %s\n", reviewer1, reviewer2)
	content += fmt.Sprintf("- **Timestamp**: %s\n", review.StartTime.Format(time.RFC3339))
	content += fmt.Sprintf("- **Duration**: %v\n", review.Duration)

	// Add custom metadata
	for key, value := range metadata {
		content += fmt.Sprintf("- **%s**: %s\n", key, value)
	}

	content += "\n## Synthesized Review\n\n"
	content += review.Content
	content += "\n"

	return content
}
