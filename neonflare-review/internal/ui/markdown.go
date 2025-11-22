package ui

import (
	"fmt"

	"github.com/charmbracelet/glamour"
)

// RenderMarkdown renders markdown content using Glamour
func RenderMarkdown(content string, width int) (string, error) {
	// Create a glamour renderer with dark style
	r, err := glamour.NewTermRenderer(
		glamour.WithAutoStyle(),
		glamour.WithWordWrap(width),
	)
	if err != nil {
		return "", fmt.Errorf("failed to create markdown renderer: %w", err)
	}

	// Render the markdown
	rendered, err := r.Render(content)
	if err != nil {
		return "", fmt.Errorf("failed to render markdown: %w", err)
	}

	return rendered, nil
}

// RenderMarkdownSimple renders markdown with default settings
func RenderMarkdownSimple(content string) (string, error) {
	r, err := glamour.NewTermRenderer(
		glamour.WithAutoStyle(),
	)
	if err != nil {
		return "", err
	}

	return r.Render(content)
}
