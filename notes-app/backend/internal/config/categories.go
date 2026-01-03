package config

// CATEGORIES defines all available note categories
var CATEGORIES = []string{
	// Personal & Life
	"journal", "reflections", "goals", "ideas", "thoughts", "dreams", "personal-growth",

	// Health & Fitness
	"recipes", "workouts", "meal-planning", "health-tips", "medical", "nutrition",

	// Work & Productivity
	"meeting-notes", "tasks", "project-ideas", "research", "documentation", "work-thoughts",

	// Learning & Growth
	"book-notes", "article-notes", "podcast-transcripts", "courses", "tutorials", "learning",

	// Relationships & Social
	"relationship-thoughts", "family", "social-interactions", "networking", "communication",

	// Financial & Planning
	"budgeting", "investments", "financial-planning", "expenses", "money-thoughts",

	// Travel & Adventure
	"travel-plans", "places-to-visit", "travel-experiences", "adventure-ideas",

	// Creative & Hobbies
	"writing-ideas", "art-projects", "creative-inspiration", "hobbies", "entertainment",

	// Technical & Code
	"coding-notes", "technical-docs", "troubleshooting", "apis", "programming",

	// Other
	"other", "miscellaneous", "random-thoughts",
}

// IsValidCategory checks if a category exists in the CATEGORIES list
func IsValidCategory(category string) bool {
	for _, validCat := range CATEGORIES {
		if category == validCat {
			return true
		}
	}
	return false
}
