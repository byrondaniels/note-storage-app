# Notes App - Automatic Categorization Implementation Plan

## 🎯 Project Goal
Add automatic AI-powered categorization to notes using Gemini API, with category-based browsing and filtering in the frontend.

---

## ✅ Current Status & Achievements

### **Working Features (Complete):**
- ✅ Vue.js frontend with upload, view, and search pages
- ✅ Golang backend with async job processing
- ✅ MongoDB for note storage
- ✅ Qdrant vector database for embeddings
- ✅ Gemini API integration for semantic search
- ✅ **Sensitive data filtering** (API keys, passwords, etc.)
- ✅ Search relevance filtering (65% threshold)
- ✅ Results sorted by relevance score
- ✅ Containerized with Docker Compose

### **In Progress:**
- 🔄 Category field added to Note model (partially done)
- 🔄 ProcessingJob struct renamed (partially done)

---

## 📋 Complete Implementation Plan

### **Phase 1: Backend Category System** ⭐ HIGH PRIORITY

#### **1.1 Data Model Updates**
```go
type Note struct {
    ID       primitive.ObjectID `json:"id" bson:"_id,omitempty"`
    Title    string             `json:"title" bson:"title"`
    Content  string             `json:"content" bson:"content"`
    Category string             `json:"category" bson:"category"`  // ✅ DONE
    Created  time.Time          `json:"created" bson:"created"`
}
```

#### **1.2 Category List (Initial 35 Categories)**
```go
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
    "other", "miscellaneous", "random-thoughts"
}
```

#### **1.3 AI Classification Function**
```go
func classifyNote(title, content string) (string, error) {
    prompt := fmt.Sprintf(`
Classify this note into exactly ONE of these categories: %s

Note Title: %s
Note Content: %s

Rules:
1. Return ONLY the category name, nothing else
2. Choose the MOST relevant category
3. If uncertain, use "other"
4. Be consistent with similar content

Category:`, strings.Join(CATEGORIES, ", "), title, content)

    // Use Gemini text generation API
    model := genaiClient.GenerativeModel("gemini-pro")
    result, err := model.GenerateContent(ctx, genai.Text(prompt))
    // Parse and validate result
    // Return category
}
```

#### **1.4 Update Processing Job System**
```go
func processNoteJob(job ProcessingJob) error {
    fullText := job.Title + "\n\n" + job.Content
    
    // 1. Classify the note (always do this, even for sensitive content)
    category, err := classifyNote(job.Title, job.Content)
    if err != nil {
        log.Printf("Classification failed for note %s: %v", job.NoteID.Hex(), err)
        category = "other" // fallback
    }
    
    // 2. Update note with category
    _, err = notesCollection.UpdateOne(
        context.Background(),
        bson.M{"_id": job.NoteID},
        bson.M{"$set": bson.M{"category": category}},
    )
    
    // 3. Skip embedding if sensitive data detected
    if containsSensitiveData(fullText) {
        log.Printf("Skipping embedding for note %s: Sensitive data detected", job.NoteID.Hex())
        return nil
    }
    
    // 4. Continue with embedding generation...
    // (existing embedding code)
}
```

#### **1.5 New API Endpoints**
```go
// GET /categories - Get all available categories with counts
func getCategories(c *gin.Context) {
    // Aggregate categories from database with counts
}

// GET /notes/category/{category} - Get notes by category
func getNotesByCategory(c *gin.Context) {
    category := c.Param("category")
    // Query notes by category, sorted by created date
}

// GET /categories/stats - Get category statistics
func getCategoryStats(c *gin.Context) {
    // Return category distribution data
}
```

---

### **Phase 2: Frontend Category Interface** ⭐ MEDIUM PRIORITY

#### **2.1 New Category Browser Component**
```vue
<!-- CategoryBrowser.vue -->
<template>
  <div class="category-browser">
    <h1>Browse by Category</h1>
    
    <!-- Category Grid -->
    <div class="category-grid">
      <div v-for="category in categories" 
           :key="category.name"
           @click="selectCategory(category.name)"
           class="category-card">
        <h3>{{ formatCategoryName(category.name) }}</h3>
        <span class="note-count">{{ category.count }} notes</span>
      </div>
    </div>
    
    <!-- Selected Category Notes -->
    <div v-if="selectedCategory" class="category-notes">
      <h2>{{ formatCategoryName(selectedCategory) }}</h2>
      <div class="notes-grid">
        <!-- Note cards -->
      </div>
    </div>
  </div>
</template>
```

#### **2.2 Update Navigation**
Add "Browse Categories" to main navigation in App.vue:
```vue
<nav>
  <router-link to="/">Upload Notes</router-link>
  <router-link to="/view">View Notes</router-link>
  <router-link to="/search">Search Notes</router-link>
  <router-link to="/categories">Browse Categories</router-link>
</nav>
```

#### **2.3 Add Category Display to Existing Components**
- Update ViewNotes.vue to show category badges
- Update SearchNotes.vue to show categories in results
- Add category filter to search interface

---

### **Phase 3: Data Migration & Enhancement** ⭐ LOW PRIORITY

#### **3.1 Classify Existing Notes**
```go
// One-time migration script or endpoint
func classifyExistingNotes() {
    cursor, _ := notesCollection.Find(context.Background(), bson.M{"category": bson.M{"$exists": false}})
    for cursor.Next(context.Background()) {
        var note Note
        cursor.Decode(&note)
        
        category, _ := classifyNote(note.Title, note.Content)
        notesCollection.UpdateOne(
            context.Background(),
            bson.M{"_id": note.ID},
            bson.M{"$set": bson.M{"category": category}},
        )
    }
}
```

---

## 🔧 Implementation Steps (In Order)

### **Immediate Next Steps:**
1. ✅ Add category field to Note struct (DONE)
2. ✅ Rename EmbeddingJob to ProcessingJob (DONE)
3. 🔄 Add CATEGORIES constant array
4. 🔄 Implement classifyNote() function
5. 🔄 Update processNoteJob() to include classification
6. 🔄 Add new API endpoints for categories
7. 🔄 Test classification on new notes

### **Frontend Steps:**
8. 🔄 Create CategoryBrowser.vue component
9. 🔄 Add category route to router
10. 🔄 Update navigation with category link
11. 🔄 Add category badges to existing note displays

### **Final Steps:**
12. 🔄 Create migration script for existing notes
13. 🔄 Test complete system
14. 🔄 Add category analytics/insights

---

## 🚀 Key Features After Implementation

### **User Experience:**
- Automatic categorization of all new notes
- Browse notes by category (like a filing cabinet)
- Category-based filtering in search
- Visual category distribution/stats
- Category badges on all note displays

### **Technical Benefits:**
- Organized data structure
- Fast category-based queries (indexed)
- Maintains existing search functionality
- Expandable category system
- Preserved sensitive data protection

---

## 📁 File Locations

### **Backend Files to Modify:**
- `/backend/main.go` - Main implementation
- `/backend/go.mod` - Dependencies (already good)

### **Frontend Files to Modify:**
- `/frontend/src/components/CategoryBrowser.vue` - NEW FILE
- `/frontend/src/App.vue` - Add navigation
- `/frontend/src/main.js` - Add category route
- `/frontend/src/components/ViewNotes.vue` - Add category display
- `/frontend/src/components/SearchNotes.vue` - Add category display

### **Docker:**
- No changes needed, existing setup works

---

## 🎯 Success Criteria

1. ✅ New notes automatically get categories
2. ✅ Category browser shows organized note groups  
3. ✅ Fast category-based note retrieval
4. ✅ Existing search functionality preserved
5. ✅ Sensitive data protection maintained
6. ✅ Clean, intuitive category interface

---

## 💡 Future Enhancements

- Custom category creation by users
- Category-based analytics and insights
- Smart category suggestions
- Category hierarchy (subcategories)
- Category-based export/backup
- Multi-category tagging (advanced)

---

**Status:** Ready to continue implementation
**Next Session:** Start with adding CATEGORIES constant and classifyNote() function
**Estimated Time:** 2-3 hours for complete implementation