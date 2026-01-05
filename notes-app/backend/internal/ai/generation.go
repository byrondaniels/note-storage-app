package ai

import (
	"context"
	"fmt"
	"log"
	"strings"

	"github.com/google/generative-ai-go/genai"

	"backend/internal/config"
	"backend/internal/models"
)

// ClassifyNote classifies a note into one of the predefined categories
func (c *AIClient) ClassifyNote(title, content string) (string, error) {
	prompt := fmt.Sprintf(`
Classify this note into exactly ONE of these categories: %s

Note Title: %s
Note Content: %s

Rules:
1. Return ONLY the category name, nothing else
2. Choose the MOST relevant category
3. If uncertain, use "other"
4. Be consistent with similar content

Category:`, strings.Join(config.CATEGORIES, ", "), title, content)

	ctx := context.Background()
	model := c.GenerativeModel(config.GENERATION_MODEL)
	result, err := model.GenerateContent(ctx, genai.Text(prompt))
	if err != nil {
		return "", fmt.Errorf("failed to generate classification: %w", err)
	}

	categoryText, err := ExtractTextResponse(result)
	if err != nil {
		return "", fmt.Errorf("failed to extract classification: %w", err)
	}

	category := strings.ToLower(categoryText)

	// Validate category is in our list
	if config.IsValidCategory(category) {
		return category, nil
	}

	// If not found, return "other"
	return "other", nil
}

// AnalyzeNote performs title generation, classification, and summary in a single API call
func (c *AIClient) AnalyzeNote(content string, includeSummary bool) (*models.NoteAnalysis, error) {
	// Get first 2000 characters for analysis to avoid token limits while keeping enough context
	excerpt := content
	if len(content) > 2000 {
		excerpt = content[:2000] + "..."
	}

	summaryInstruction := ""
	summaryField := `"summary": ""`
	if includeSummary {
		summaryInstruction = `4. "summary": A concise summary (2-4 sentences) capturing the key points and main takeaways`
		summaryField = `"summary": "your summary here"`
	}

	prompt := fmt.Sprintf(`Analyze this note and return a JSON object with the following fields:

1. "title": A concise, descriptive title (2-10 words, no quotes or special formatting)
2. "category": Exactly ONE category from this list: %s
3. Choose the MOST relevant category. If uncertain, use "other"
%s

IMPORTANT: Return ONLY valid JSON, no markdown formatting, no code blocks, just the raw JSON object.

Content to analyze:
%s

Return this exact JSON structure:
{"title": "your title here", "category": "category-name", %s}`,
		strings.Join(config.CATEGORIES, ", "),
		summaryInstruction,
		excerpt,
		summaryField)

	ctx := context.Background()
	model := c.GenerativeModel(config.GENERATION_MODEL)
	result, err := model.GenerateContent(ctx, genai.Text(prompt))
	if err != nil {
		return nil, fmt.Errorf("failed to analyze note: %w", err)
	}

	var analysis models.NoteAnalysis
	if err := ExtractJSONResponse(result, &analysis); err != nil {
		log.Printf("Failed to extract analysis JSON: %v", err)
		return nil, fmt.Errorf("failed to parse analysis response: %w", err)
	}

	// Validate and clean up title
	analysis.Title = strings.Trim(analysis.Title, "\"'")
	if len(analysis.Title) > 100 {
		analysis.Title = analysis.Title[:100]
	}
	if analysis.Title == "" {
		analysis.Title = "Untitled Note"
	}

	// Validate category
	analysis.Category = strings.ToLower(strings.TrimSpace(analysis.Category))
	if !config.IsValidCategory(analysis.Category) {
		analysis.Category = "other"
	}

	return &analysis, nil
}

// GenerateAnswer generates an answer to a question based on provided context
func (c *AIClient) GenerateAnswer(question, contextText string) (string, error) {
	prompt := fmt.Sprintf(`You are an AI assistant helping someone understand their personal notes. Based on the provided context from their notes, answer their question in a helpful and conversational way.

Context from their notes:
%s

Question: %s

Instructions:
1. Answer based ONLY on the information provided in the context
2. Be conversational and helpful
3. If the context doesn't contain enough information, say so politely
4. Reference specific notes when relevant (e.g., "According to your note about...")
5. Keep the answer concise but complete

Answer:`, contextText, question)

	ctx := context.Background()
	model := c.GenerativeModel(config.GENERATION_MODEL)
	result, err := model.GenerateContent(ctx, genai.Text(prompt))
	if err != nil {
		return "", fmt.Errorf("failed to generate answer: %w", err)
	}

	return ExtractTextResponse(result)
}

// GenerateTitle generates a concise, descriptive title for note content
func (c *AIClient) GenerateTitle(content string) (string, error) {
	// Get first 500 characters for title generation to avoid token limits
	excerpt := content
	if len(content) > 500 {
		excerpt = content[:500] + "..."
	}

	prompt := fmt.Sprintf(`Generate a concise, descriptive title for this note content. The title should:

1. Be accurate and specific to the content
2. Be 2-10 words maximum
3. Capture the main topic/theme
4. Be clear and searchable
5. NOT include quotation marks or special formatting

Content:
%s

Title:`, excerpt)

	ctx := context.Background()
	model := c.GenerativeModel(config.GENERATION_MODEL)
	result, err := model.GenerateContent(ctx, genai.Text(prompt))
	if err != nil {
		return "", fmt.Errorf("failed to generate title: %w", err)
	}

	title, err := ExtractTextResponse(result)
	if err != nil {
		return "", fmt.Errorf("failed to extract title: %w", err)
	}

	// Clean up the title (remove quotes, ensure reasonable length)
	title = strings.Trim(title, "\"'")
	if len(title) > 100 {
		title = title[:100]
	}
	if title == "" {
		title = "Untitled Note"
	}

	return title, nil
}

// GenerateSummary generates a summary using the default prompt
func (c *AIClient) GenerateSummary(content string) (string, error) {
	return c.GenerateSummaryWithPrompt(content, "")
}

// GenerateSummaryWithPrompt generates a summary with an optional custom prompt
func (c *AIClient) GenerateSummaryWithPrompt(content string, customPrompt string) (string, error) {
	var prompt string

	if customPrompt != "" {
		// Use custom prompt - append content to it
		prompt = fmt.Sprintf(`%s

Content to summarize:
%s`, customPrompt, content)
	} else {
		// Use default prompt
		prompt = fmt.Sprintf(`Please provide a concise and well-formatted summary of the following content. The summary should:

1. Be concise and to-the-point - avoid unnecessary words
2. If the content includes lists or multiple points, clearly outline each point with bullet points or numbered lists
3. Use proper spacing with line breaks between different sections or topics
4. Structure the information logically with clear paragraphs
5. Capture the key takeaways and main ideas
6. If there are actionable items or recommendations, list them clearly
7. Maintain the essential context but eliminate redundancy

Format your response with:
- Clear paragraph breaks between different topics
- Bullet points (•) or numbered lists when covering multiple items
- Proper spacing for readability

Content to summarize:
%s

Summary:`, content)
	}

	ctx := context.Background()
	model := c.GenerativeModel(config.GENERATION_MODEL)
	result, err := model.GenerateContent(ctx, genai.Text(prompt))
	if err != nil {
		return "", fmt.Errorf("failed to generate summary: %w", err)
	}

	return ExtractTextResponse(result)
}

// GenerateStructuredSummary generates a summary with structured data based on a schema
func (c *AIClient) GenerateStructuredSummary(content, promptText, promptSchema string) (string, map[string]interface{}, error) {
	// If no schema provided, fall back to regular summary
	if promptSchema == "" {
		summary, err := c.GenerateSummaryWithPrompt(content, promptText)
		if err != nil {
			return "", nil, err
		}
		return summary, nil, nil
	}

	// Build prompt that requests JSON output matching the schema
	prompt := fmt.Sprintf(`%s

You MUST respond with valid JSON matching this exact structure:
%s

IMPORTANT:
- Return ONLY valid JSON, no markdown formatting, no code blocks
- The "summary" field must always be included as a string
- Follow the schema structure exactly

Content to analyze:
%s`, promptText, promptSchema, content)

	ctx := context.Background()
	model := c.GenerativeModel(config.GENERATION_MODEL)
	result, err := model.GenerateContent(ctx, genai.Text(prompt))
	if err != nil {
		return "", nil, fmt.Errorf("failed to generate structured summary: %w", err)
	}

	// Parse the JSON response
	var structuredData map[string]interface{}
	if err := ExtractJSONResponse(result, &structuredData); err != nil {
		log.Printf("Failed to parse structured summary JSON: %v", err)
		// Fall back to treating the response as plain text summary
		responseText, _ := ExtractTextResponse(result)
		return responseText, nil, nil
	}

	// Extract summary field
	summary := ""
	if summaryVal, ok := structuredData["summary"]; ok {
		if summaryStr, ok := summaryVal.(string); ok {
			summary = summaryStr
		}
	}

	return summary, structuredData, nil
}

// AskAboutContent asks the AI a question about specific content
func (c *AIClient) AskAboutContent(prompt, content string) (string, error) {
	fullPrompt := fmt.Sprintf(`%s

Content to analyze:
%s`, prompt, content)

	ctx := context.Background()
	model := c.GenerativeModel(config.GENERATION_MODEL)
	result, err := model.GenerateContent(ctx, genai.Text(fullPrompt))
	if err != nil {
		return "", fmt.Errorf("failed to generate AI response: %w", err)
	}

	return ExtractTextResponse(result)
}
