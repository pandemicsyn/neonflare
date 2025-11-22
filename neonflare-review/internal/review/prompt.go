package review

import (
	"bytes"
	"fmt"
	"os"
	"text/template"
)

// PromptData contains data for prompt templates
type PromptData struct {
	UserPrompt   string
	Code         string // Deprecated: use CodePath instead
	CodePath     string // Path to code file or directory
	ReviewSource string // Description of what to review (e.g., "staged changes", "commit abc123")
	Agent1Name   string
	Agent2Name   string
	Review1      string
	Review2      string
}

// BuildReviewerPrompt builds the prompt for a reviewer agent (legacy - embeds code)
func BuildReviewerPrompt(templatePath string, code string, userPrompt string) (string, error) {
	// Try to load custom template
	tmplContent, err := os.ReadFile(templatePath)
	if err != nil {
		// Fall back to default template
		tmplContent = []byte(defaultReviewerTemplate)
	}

	tmpl, err := template.New("reviewer").Parse(string(tmplContent))
	if err != nil {
		return "", fmt.Errorf("failed to parse reviewer template: %w", err)
	}

	data := PromptData{
		UserPrompt: userPrompt,
		Code:       code,
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		return "", fmt.Errorf("failed to execute reviewer template: %w", err)
	}

	return buf.String(), nil
}

// BuildReviewerPromptWithPath builds the prompt for a reviewer agent using file paths
func BuildReviewerPromptWithPath(templatePath string, codePath string, reviewSource string, userPrompt string) (string, error) {
	// Use file-based template
	tmplContent, err := os.ReadFile(templatePath)
	if err != nil {
		// Fall back to default file-based template
		tmplContent = []byte(defaultReviewerFileTemplate)
	}

	tmpl, err := template.New("reviewer").Parse(string(tmplContent))
	if err != nil {
		return "", fmt.Errorf("failed to parse reviewer template: %w", err)
	}

	data := PromptData{
		UserPrompt:   userPrompt,
		CodePath:     codePath,
		ReviewSource: reviewSource,
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		return "", fmt.Errorf("failed to execute reviewer template: %w", err)
	}

	return buf.String(), nil
}

// BuildAggregatorPrompt builds the prompt for the aggregator agent
func BuildAggregatorPrompt(templatePath string, agent1Name, agent2Name string, review1, review2 string, userPrompt string) (string, error) {
	// Try to load custom template
	tmplContent, err := os.ReadFile(templatePath)
	if err != nil {
		// Fall back to default template
		tmplContent = []byte(defaultAggregatorTemplate)
	}

	tmpl, err := template.New("aggregator").Parse(string(tmplContent))
	if err != nil {
		return "", fmt.Errorf("failed to parse aggregator template: %w", err)
	}

	data := PromptData{
		UserPrompt: userPrompt,
		Agent1Name: agent1Name,
		Agent2Name: agent2Name,
		Review1:    review1,
		Review2:    review2,
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		return "", fmt.Errorf("failed to execute aggregator template: %w", err)
	}

	return buf.String(), nil
}

// Default templates embedded in the binary
const defaultReviewerTemplate = `You are a code reviewer. Analyze the following code and provide:
- Issues and bugs
- Code quality concerns
- Security vulnerabilities
- Performance considerations
- Best practice violations

{{ if .UserPrompt }}
Additional instructions: {{ .UserPrompt }}
{{ end }}

Code to review:
{{ .Code }}`

const defaultReviewerFileTemplate = `You are a code reviewer. Your task is to review {{ .ReviewSource }}.

Please analyze the code and provide a comprehensive review covering:
- Issues and bugs
- Code quality concerns
- Security vulnerabilities
- Performance considerations
- Best practice violations

{{ if .UserPrompt }}
Additional instructions: {{ .UserPrompt }}
{{ end }}

{{ if .CodePath }}
The code to review is located at: {{ .CodePath }}

Use the Read tool to examine the file(s), and Bash tool (with git commands) if you need to see diffs or commit history.
{{ else }}
Use the Bash tool with git commands to examine {{ .ReviewSource }}.

Suggested commands:
- git diff --staged (for staged changes)
- git show <commit> (for specific commits)
- git diff <commit> (for commit ranges)
{{ end }}

Provide your review in markdown format with clear sections and actionable recommendations.`

const defaultAggregatorTemplate = `You are reviewing two code reviews from other AI agents.
Your task is to synthesize their findings into a single, coherent review.

- Identify common findings (high confidence)
- Note conflicting opinions
- Prioritize critical issues
- Remove redundancy
- Provide actionable recommendations

{{ if .UserPrompt }}
Additional instructions: {{ .UserPrompt }}
{{ end }}

Review 1 ({{ .Agent1Name }}):
{{ .Review1 }}

Review 2 ({{ .Agent2Name }}):
{{ .Review2 }}`
