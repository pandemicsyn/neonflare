package prompts

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// Profile represents a review prompt profile
type Profile struct {
	Name    string // Display name (derived from filename)
	Path    string // Full path to the file
	Content string // The prompt content
}

// ProfileManager manages prompt profiles
type ProfileManager struct {
	configDir string
	profiles  map[string]*Profile
}

// NewProfileManager creates a new profile manager
func NewProfileManager() (*ProfileManager, error) {
	// Get home directory
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return nil, fmt.Errorf("failed to get home directory: %w", err)
	}

	configDir := filepath.Join(homeDir, ".config", "neonflare")

	pm := &ProfileManager{
		configDir: configDir,
		profiles:  make(map[string]*Profile),
	}

	// Load profiles from disk
	if err := pm.loadProfiles(); err != nil {
		// Don't fail if profiles don't exist yet - just continue with empty list
		// Users can create them later
		return pm, nil
	}

	return pm, nil
}

// loadProfiles loads all prompt profiles from the reviewer-prompts directory
func (pm *ProfileManager) loadProfiles() error {
	promptsDir := filepath.Join(pm.configDir, "reviewer-prompts")

	// Check if directory exists
	if _, err := os.Stat(promptsDir); os.IsNotExist(err) {
		// Directory doesn't exist - create it with a default example
		if err := os.MkdirAll(promptsDir, 0755); err != nil {
			return fmt.Errorf("failed to create prompts directory: %w", err)
		}

		// Create a default example profile
		examplePath := filepath.Join(promptsDir, "frontend-expert.md")
		exampleContent := `You are an expert TypeScript and React developer with deep knowledge of modern frontend best practices.

Focus your review on:
- TypeScript type safety and correctness
- React component design and hooks usage
- Performance considerations (re-renders, memoization)
- Accessibility (a11y) issues
- CSS/styling best practices
- Frontend security concerns (XSS, etc.)

Ignore backend code unless it directly impacts the frontend. Be thorough but concise.`

		if err := os.WriteFile(examplePath, []byte(exampleContent), 0644); err != nil {
			// Don't fail if we can't create example - just log and continue
			fmt.Printf("Note: Created example prompt profile at %s\n", examplePath)
		}
	}

	// Read all .md files from the directory
	entries, err := os.ReadDir(promptsDir)
	if err != nil {
		return fmt.Errorf("failed to read prompts directory: %w", err)
	}

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		// Only process .md files
		if !strings.HasSuffix(entry.Name(), ".md") {
			continue
		}

		fullPath := filepath.Join(promptsDir, entry.Name())
		content, err := os.ReadFile(fullPath)
		if err != nil {
			fmt.Printf("Warning: failed to read profile %s: %v\n", entry.Name(), err)
			continue
		}

		// Create profile name from filename (remove .md extension)
		name := strings.TrimSuffix(entry.Name(), ".md")
		// Convert to display name (replace dashes/underscores with spaces, title case)
		displayName := strings.ReplaceAll(name, "-", " ")
		displayName = strings.ReplaceAll(displayName, "_", " ")
		displayName = strings.Title(displayName)

		pm.profiles[name] = &Profile{
			Name:    displayName,
			Path:    fullPath,
			Content: string(content),
		}
	}

	return nil
}

// GetProfiles returns all available profiles
func (pm *ProfileManager) GetProfiles() []*Profile {
	profiles := make([]*Profile, 0, len(pm.profiles))
	for _, profile := range pm.profiles {
		profiles = append(profiles, profile)
	}
	return profiles
}

// GetProfile returns a specific profile by name
func (pm *ProfileManager) GetProfile(name string) *Profile {
	return pm.profiles[name]
}

// GetProfileNames returns a list of profile names for selection
func (pm *ProfileManager) GetProfileNames() []string {
	names := make([]string, 0, len(pm.profiles))
	for name := range pm.profiles {
		names = append(names, name)
	}
	return names
}

// HasProfiles returns true if any profiles are loaded
func (pm *ProfileManager) HasProfiles() bool {
	return len(pm.profiles) > 0
}

// GetConfigDir returns the config directory path
func (pm *ProfileManager) GetConfigDir() string {
	return pm.configDir
}

// GetReviewsDir returns the reviews output directory path
func (pm *ProfileManager) GetReviewsDir() string {
	return filepath.Join(pm.configDir, "reviews")
}

// EnsureReviewsDir ensures the reviews directory exists
func (pm *ProfileManager) EnsureReviewsDir() error {
	reviewsDir := pm.GetReviewsDir()
	return os.MkdirAll(reviewsDir, 0755)
}
