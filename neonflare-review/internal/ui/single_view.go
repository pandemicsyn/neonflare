package ui

import (
	"fmt"
	"strings"

	"github.com/charmbracelet/lipgloss"
)

// renderSingleView renders the single-screen view for aggregate review
func (m Model) renderSingleView() string {
	if m.width == 0 || m.height == 0 {
		return "Waiting for terminal size..."
	}

	contentHeight := m.height - 8
	contentWidth := m.width - 4

	// Build header
	var header string
	if m.mode == ViewModeDone {
		header = titleStyle.Render(" 🎉 Review Complete ")
	} else {
		header = titleStyle.Render(fmt.Sprintf(" 🔍 Aggregating Reviews: %s ", m.aggregatorName))
	}
	header += "\n\n"

	// Status info
	statusInfo := ""
	if m.review1Done && m.review2Done {
		statusInfo = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#00FF00")).
			Render(fmt.Sprintf("✓ %s review complete\n", m.reviewer1Name))
		statusInfo += lipgloss.NewStyle().
			Foreground(lipgloss.Color("#00FF00")).
			Render(fmt.Sprintf("✓ %s review complete\n", m.reviewer2Name))
		statusInfo += "\n"
	}

	// Aggregate content
	var aggregateStatus string
	if m.aggregateDone || m.mode == ViewModeDone {
		aggregateStatus = statusComplete
	} else {
		aggregateStatus = statusInProgress
	}

	aggregateTitle := lipgloss.NewStyle().
		Bold(true).
		Foreground(lipgloss.Color("#BD93F9")).
		Render(fmt.Sprintf("Aggregator: %s", m.aggregatorName))

	aggregateContent := m.aggregateContent.String()
	if aggregateContent == "" {
		aggregateContent = "Waiting for aggregate review to start..."
	}

	// Render markdown if done, otherwise show raw content
	if m.mode == ViewModeDone && m.aggregateResult != nil {
		rendered, err := RenderMarkdown(m.aggregateResult.Content, m.width-6)
		if err == nil {
			aggregateContent = rendered
		} else {
			aggregateContent = m.aggregateResult.Content
		}
	}

	// Truncate content to fit panel
	lines := strings.Split(aggregateContent, "\n")
	if len(lines) > contentHeight-5 {
		// Show last lines (most recent content)
		if m.mode == ViewModeDone {
			// When done, show from the beginning
			lines = lines[:contentHeight-5]
		} else {
			// While in progress, show tail
			lines = lines[len(lines)-(contentHeight-5):]
		}
		aggregateContent = strings.Join(lines, "\n")
	}

	// Create content panel
	panelStyle := lipgloss.NewStyle().
		Width(contentWidth).
		Height(contentHeight).
		Border(lipgloss.RoundedBorder()).
		BorderForeground(lipgloss.Color("#BD93F9")).
		Padding(1)

	panelContent := fmt.Sprintf("%s\n%s\n\n%s", aggregateTitle, aggregateStatus, aggregateContent)
	panel := panelStyle.Render(panelContent)

	// Footer
	footer := "\n"
	if m.mode == ViewModeDone {
		footer += lipgloss.NewStyle().
			Foreground(lipgloss.Color("#00FF00")).
			Bold(true).
			Render("Review files have been saved. ")
	}
	footer += lipgloss.NewStyle().
		Foreground(lipgloss.Color("#666666")).
		Render("Press Ctrl+C or 'q' to quit")

	return header + statusInfo + panel + footer
}
