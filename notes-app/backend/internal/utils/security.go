package utils

import (
	"log"
	"regexp"
)

// Pre-compiled regex patterns for sensitive data detection
var sensitivePatterns = []*regexp.Regexp{
	// API Keys
	regexp.MustCompile(`(?i)(api[_-]?key|apikey)\s*[:=]\s*[a-zA-Z0-9_-]{10,}`),
	regexp.MustCompile(`sk-[a-zA-Z0-9]{32,}`),                    // OpenAI API keys
	regexp.MustCompile(`AIza[a-zA-Z0-9_-]{35}`),                  // Google API keys
	regexp.MustCompile(`ya29\.[a-zA-Z0-9_-]+`),                   // Google OAuth tokens
	regexp.MustCompile(`ghp_[a-zA-Z0-9]{36}`),                    // GitHub personal access tokens
	regexp.MustCompile(`gho_[a-zA-Z0-9]{36}`),                    // GitHub OAuth tokens

	// Passwords
	regexp.MustCompile(`(?i)(password|passwd|pwd)\s*[:=]\s*\S{6,}`),
	regexp.MustCompile(`(?i)(pass|pw)\s*[:=]\s*['"]\S{6,}['"]`),

	// Secrets and Tokens
	regexp.MustCompile(`(?i)(secret|token|auth)\s*[:=]\s*[a-zA-Z0-9_-]{10,}`),
	regexp.MustCompile(`(?i)bearer\s+[a-zA-Z0-9_-]{10,}`),
	regexp.MustCompile(`(?i)access[_-]?token\s*[:=]\s*[a-zA-Z0-9_-]{10,}`),

	// Database Connection Strings
	regexp.MustCompile(`(?i)(mongodb|mysql|postgres|redis)://[^\s]+`),
	regexp.MustCompile(`(?i)connection[_-]?string\s*[:=]\s*[^\s;]+`),

	// Private Keys (basic detection)
	regexp.MustCompile(`-----BEGIN [A-Z\s]+ PRIVATE KEY-----`),
	regexp.MustCompile(`(?i)private[_-]?key\s*[:=]\s*[a-zA-Z0-9+/=]{20,}`),

	// Common service tokens
	regexp.MustCompile(`xoxb-[a-zA-Z0-9-]+`), // Slack bot tokens
	regexp.MustCompile(`xoxp-[a-zA-Z0-9-]+`), // Slack user tokens
}

// ContainsSensitiveData checks if text contains patterns that match sensitive information
// such as API keys, passwords, tokens, or connection strings
func ContainsSensitiveData(text string) bool {
	for _, pattern := range sensitivePatterns {
		if pattern.MatchString(text) {
			log.Printf("Sensitive data pattern matched: %s", pattern.String())
			return true
		}
	}
	return false
}
