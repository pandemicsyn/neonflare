package ui

import (
	"fmt"

	"github.com/charmbracelet/lipgloss"
)

// renderAggregationView renders the single-viewport aggregation view
func (m Model) renderAggregationView() string {
	if m.width == 0 || m.height == 0 {
		return "Waiting for terminal size..."
	}

	// Calculate dimensions for single view
	contentWidth := m.width - 8   // Leave room for borders and padding
	contentHeight := m.height - 8 // Leave room for title and status

	// Create style for the panel
	panelStyle := lipgloss.NewStyle().
		Width(contentWidth).
		Height(contentHeight).
		Border(lipgloss.RoundedBorder()).
		BorderForeground(lipgloss.Color("#FF79C6")). // Pink border
		Padding(1)

	// Build header
	header := titleStyle.Render(fmt.Sprintf(" 🔍 Neonflare Review - Aggregation "))
	header += "\n\n"

	// Panel title
	panelTitle := lipgloss.NewStyle().
		Bold(true).
		Foreground(lipgloss.Color("#FF79C6")).
		Render(fmt.Sprintf("Aggregator: %s", m.aggregatorName))

	// Status
	var status string
	progressText := ""
	if m.aggregationDone {
		status = statusComplete
	} else {
		status = statusInProgress
		if m.aggregationProgress > 0 {
			progressText = lipgloss.NewStyle().
				Foreground(lipgloss.Color("#8BE9FD")).
				Render(fmt.Sprintf(" (%ds)", m.aggregationProgress))
		}
	}

	// Use viewport for scrollable content
	viewportContent := m.aggregationViewport.View()

	// Add scroll position indicator
	scrollIndicator := ""
	if m.aggregationViewport.ScrollPercent() < 1.0 {
		scrollIndicator = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#8BE9FD")).
			Render(fmt.Sprintf(" [%.0f%%]", m.aggregationViewport.ScrollPercent()*100))
	}

	panel := fmt.Sprintf("%s\n%s%s%s\n\n%s", panelTitle, status, progressText, scrollIndicator, viewportContent)

	// Render panel
	renderedPanel := panelStyle.Render(panel)

	// Footer - split into left status and right shortcuts
	var statusMsg string
	shortcuts := "↑/↓: scroll | g: top | G: bottom | q: quit"

	if m.aggregationDone {
		statusMsg = "✓ Aggregation complete!"
		shortcuts = "g: top | G: bottom | q: exit"
	}

	// Create footer with status on left and shortcuts on right
	footerStyle := lipgloss.NewStyle().Foreground(lipgloss.Color("#666666"))

	statusText := footerStyle.Render(statusMsg)
	shortcutsText := footerStyle.Copy().Align(lipgloss.Right).Width(m.width - len(statusMsg)).Render(shortcuts)

	footer := "\n" + lipgloss.JoinHorizontal(lipgloss.Top, statusText, shortcutsText)

	return header + renderedPanel + footer
}
