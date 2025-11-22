package input

import (
	"fmt"
	"os/exec"
	"path/filepath"
	"strings"
)

// GitOptions contains options for reading from a git repository
type GitOptions struct {
	RepoPath string // Path to the git repository
	Staged   bool   // Review only staged changes
	Commit   string // Review a specific commit
}

// ReadFromGit reads code from a git repository based on the provided options
func ReadFromGit(opts GitOptions) (string, error) {
	// Verify the path is a git repository
	if err := verifyGitRepo(opts.RepoPath); err != nil {
		return "", err
	}

	var output string
	var err error

	switch {
	case opts.Commit != "":
		// Show a specific commit
		output, err = getCommitDiff(opts.RepoPath, opts.Commit)
	case opts.Staged:
		// Show staged changes
		output, err = getStagedChanges(opts.RepoPath)
	default:
		// Show working directory changes (both staged and unstaged)
		output, err = getWorkingDirChanges(opts.RepoPath)
	}

	if err != nil {
		return "", err
	}

	if output == "" {
		return "", fmt.Errorf("no changes to review in repository")
	}

	return output, nil
}

// verifyGitRepo checks if the path is a valid git repository
func verifyGitRepo(repoPath string) error {
	absPath, err := filepath.Abs(repoPath)
	if err != nil {
		return fmt.Errorf("invalid repository path: %w", err)
	}

	cmd := exec.Command("git", "-C", absPath, "rev-parse", "--git-dir")
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("not a git repository: %s", absPath)
	}

	return nil
}

// getCommitDiff returns the diff for a specific commit
func getCommitDiff(repoPath, commit string) (string, error) {
	cmd := exec.Command("git", "-C", repoPath, "show", commit)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("failed to get commit diff: %w\noutput: %s", err, string(output))
	}
	return string(output), nil
}

// getStagedChanges returns the diff of staged changes
func getStagedChanges(repoPath string) (string, error) {
	cmd := exec.Command("git", "-C", repoPath, "diff", "--cached")
	output, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("failed to get staged changes: %w\noutput: %s", err, string(output))
	}
	return string(output), nil
}

// getWorkingDirChanges returns the diff of all changes in the working directory
func getWorkingDirChanges(repoPath string) (string, error) {
	// Get both staged and unstaged changes
	cmd := exec.Command("git", "-C", repoPath, "diff", "HEAD")
	output, err := cmd.CombinedOutput()
	if err != nil {
		// If HEAD doesn't exist (empty repo), try without HEAD
		cmd = exec.Command("git", "-C", repoPath, "diff")
		output, err = cmd.CombinedOutput()
		if err != nil {
			return "", fmt.Errorf("failed to get working dir changes: %w\noutput: %s", err, string(output))
		}
	}
	return string(output), nil
}

// GetRepoInfo returns information about the repository (for metadata)
func GetRepoInfo(repoPath string) (map[string]string, error) {
	info := make(map[string]string)

	// Get current branch
	cmd := exec.Command("git", "-C", repoPath, "rev-parse", "--abbrev-ref", "HEAD")
	if output, err := cmd.Output(); err == nil {
		info["branch"] = strings.TrimSpace(string(output))
	}

	// Get current commit hash
	cmd = exec.Command("git", "-C", repoPath, "rev-parse", "HEAD")
	if output, err := cmd.Output(); err == nil {
		info["commit"] = strings.TrimSpace(string(output))[:8] // Short hash
	}

	// Get remote URL
	cmd = exec.Command("git", "-C", repoPath, "config", "--get", "remote.origin.url")
	if output, err := cmd.Output(); err == nil {
		info["remote"] = strings.TrimSpace(string(output))
	}

	return info, nil
}
