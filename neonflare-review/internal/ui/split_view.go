package ui

import (
	"fmt"

	"github.com/charmbracelet/lipgloss"
)

// renderSplitView renders the split-screen view for parallel reviews
func (m Model) renderSplitView() string {
	if m.width == 0 || m.height == 0 {
		return "Waiting for terminal size..."
	}

	// Calculate dimensions for split view
	halfWidth := (m.width - 4) / 2 // -4 for borders and padding
	contentHeight := m.height - 8  // Leave room for title and status

	// Create styles for left and right panels with focus indicators
	focusedBorderColor := lipgloss.Color("#FF79C6") // Pink for focused
	unfocusedBorderColor := lipgloss.Color("#874BFD") // Purple for unfocused

	leftPanelStyle := lipgloss.NewStyle().
		Width(halfWidth).
		Height(contentHeight).
		Border(lipgloss.RoundedBorder()).
		BorderForeground(unfocusedBorderColor).
		Padding(1)

	rightPanelStyle := lipgloss.NewStyle().
		Width(halfWidth).
		Height(contentHeight).
		Border(lipgloss.RoundedBorder()).
		BorderForeground(unfocusedBorderColor).
		Padding(1)

	// Highlight focused panel
	if m.focusedPanel == 0 {
		leftPanelStyle = leftPanelStyle.BorderForeground(focusedBorderColor)
	} else {
		rightPanelStyle = rightPanelStyle.BorderForeground(focusedBorderColor)
	}

	// Build header
	header := titleStyle.Render(fmt.Sprintf(" 🔍 Neonflare Review - Parallel Reviews "))
	header += "\n\n"

	// Left panel - Reviewer 1
	leftTitle := lipgloss.NewStyle().
		Bold(true).
		Foreground(lipgloss.Color("#FF79C6")).
		Render(fmt.Sprintf("Reviewer 1: %s", m.reviewer1Name))

	leftStatus := statusInProgress
	progressText := ""
	if m.review1Done {
		leftStatus = statusComplete
	} else if m.review1Progress > 0 {
		progressText = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#8BE9FD")).
			Render(fmt.Sprintf(" (%ds)", m.review1Progress))
	}

	// Use viewport for scrollable content
	leftViewport := m.review1Viewport.View()

	// Add scroll position indicator
	scrollIndicator := ""
	if m.review1Viewport.ScrollPercent() < 1.0 {
		scrollIndicator = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#8BE9FD")).
			Render(fmt.Sprintf(" [%.0f%%]", m.review1Viewport.ScrollPercent()*100))
	}

	leftPanel := fmt.Sprintf("%s\n%s%s%s\n\n%s", leftTitle, leftStatus, progressText, scrollIndicator, leftViewport)

	// Right panel - Reviewer 2
	rightTitle := lipgloss.NewStyle().
		Bold(true).
		Foreground(lipgloss.Color("#50FA7B")).
		Render(fmt.Sprintf("Reviewer 2: %s", m.reviewer2Name))

	rightStatus := statusInProgress
	progressText2 := ""
	if m.review2Done {
		rightStatus = statusComplete
	} else if m.review2Progress > 0 {
		progressText2 = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#8BE9FD")).
			Render(fmt.Sprintf(" (%ds)", m.review2Progress))
	}

	// Use viewport for scrollable content
	rightViewport := m.review2Viewport.View()

	// Add scroll position indicator
	scrollIndicator2 := ""
	if m.review2Viewport.ScrollPercent() < 1.0 {
		scrollIndicator2 = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#8BE9FD")).
			Render(fmt.Sprintf(" [%.0f%%]", m.review2Viewport.ScrollPercent()*100))
	}

	rightPanel := fmt.Sprintf("%s\n%s%s%s\n\n%s", rightTitle, rightStatus, progressText2, scrollIndicator2, rightViewport)

	// Combine panels side by side
	panels := lipgloss.JoinHorizontal(
		lipgloss.Top,
		leftPanelStyle.Render(leftPanel),
		rightPanelStyle.Render(rightPanel),
	)

	// Footer - split into left status and right shortcuts
	var statusMsg string
	shortcuts := "Tab: switch | ↑/↓: scroll | g: top | G: bottom | q: quit"

	if m.review1Done && m.review2Done {
		statusMsg = "✓ Reviews complete!"
		shortcuts = "Tab: switch | g: top | G: bottom | q: exit"
	}

	// Create footer with status on left and shortcuts on right
	footerStyle := lipgloss.NewStyle().Foreground(lipgloss.Color("#666666"))

	statusText := footerStyle.Render(statusMsg)
	shortcutsText := footerStyle.Copy().Align(lipgloss.Right).Width(m.width - len(statusMsg)).Render(shortcuts)

	footer := "\n" + lipgloss.JoinHorizontal(lipgloss.Top, statusText, shortcutsText)

	return header + panels + footer
}
