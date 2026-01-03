package utils

import "strings"

// ChunkText splits text into chunks of specified word count
func ChunkText(text string, chunkSize int) []string {
	words := strings.Fields(text)
	var chunks []string

	for i := 0; i < len(words); i += chunkSize {
		end := i + chunkSize
		if end > len(words) {
			end = len(words)
		}
		chunks = append(chunks, strings.Join(words[i:end], " "))
	}

	return chunks
}

// CleanMarkdownCodeBlocks removes markdown code block formatting from text
// This is commonly used when cleaning up AI-generated JSON responses
func CleanMarkdownCodeBlocks(text string) string {
	text = strings.TrimSpace(text)
	// Remove markdown code blocks if present
	text = strings.TrimPrefix(text, "```json")
	text = strings.TrimPrefix(text, "```")
	text = strings.TrimSuffix(text, "```")
	text = strings.TrimSpace(text)
	return text
}
