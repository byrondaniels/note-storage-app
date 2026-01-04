import { test as base, expect, Page } from '@playwright/test';

// API base URL for direct backend calls
const API_URL = process.env.E2E_API_URL || 'http://localhost:8081';

/**
 * Test utilities and helpers
 */
export interface TestNote {
  id?: string;
  content: string;
  title?: string;
  category?: string;
  metadata?: {
    platform?: string;
    author?: string;
    url?: string;
  };
}

/**
 * API helper for test setup and teardown
 */
export class APIHelper {
  constructor(private request: any) {}

  /**
   * Create a note via API
   */
  async createNote(note: TestNote): Promise<TestNote> {
    const response = await this.request.post(`${API_URL}/notes`, {
      data: {
        content: note.content,
        title: note.title,
        metadata: note.metadata,
      },
    });

    if (response.ok()) {
      return await response.json();
    }
    throw new Error(`Failed to create note: ${response.status()}`);
  }

  /**
   * Delete a note via API
   */
  async deleteNote(id: string): Promise<void> {
    await this.request.delete(`${API_URL}/notes/${id}`);
  }

  /**
   * Get all notes via API
   */
  async getNotes(): Promise<TestNote[]> {
    const response = await this.request.get(`${API_URL}/notes`);
    return await response.json();
  }

  /**
   * Delete all notes via API
   */
  async deleteAllNotes(): Promise<void> {
    const notes = await this.getNotes();
    for (const note of notes) {
      if (note.id) {
        await this.deleteNote(note.id);
      }
    }
  }

  /**
   * Create channel settings via API
   */
  async createChannelSettings(channelName: string, settings: any): Promise<void> {
    await this.request.put(`${API_URL}/channel-settings/${encodeURIComponent(channelName)}`, {
      data: settings,
    });
  }

  /**
   * Delete channel settings via API
   */
  async deleteChannelSettings(channelName: string): Promise<void> {
    await this.request.delete(`${API_URL}/channel-settings/${encodeURIComponent(channelName)}`);
  }
}

/**
 * Page Object for the Notes App
 */
export class NotesPage {
  constructor(private page: Page) {}

  // Navigation
  async goto() {
    await this.page.goto('/');
  }

  async gotoView() {
    await this.page.goto('/view');
  }

  async gotoAsk() {
    await this.page.goto('/ask');
  }

  async gotoSettings() {
    await this.page.goto('/settings');
  }

  // Wait for page to load
  async waitForNotesLoaded() {
    await this.page.waitForSelector('[data-testid="notes-list"], .notes-list, .no-notes', {
      timeout: 10000
    });
  }

  // Notes list interactions
  async getNotesList() {
    return this.page.locator('[data-testid="note-item"], .note-item, .note-card');
  }

  async getNotesCount() {
    const notes = await this.getNotesList();
    return await notes.count();
  }

  async selectNote(index: number) {
    const notes = await this.getNotesList();
    await notes.nth(index).click();
  }

  async selectNoteByTitle(title: string) {
    await this.page.locator(`text=${title}`).first().click();
  }

  // Note detail interactions
  async getNoteContent() {
    return this.page.locator('[data-testid="note-content"], .note-content, .note-detail .content');
  }

  async getNoteTitle() {
    return this.page.locator('[data-testid="note-title"], .note-title, .note-detail h1, .note-detail h2');
  }

  // Category interactions
  async openCategoryFilter() {
    await this.page.locator('[data-testid="category-filter"], .category-filter, button:has-text("Categories")').click();
  }

  async selectCategory(category: string) {
    await this.page.locator(`[data-testid="category-${category}"], .category-item:has-text("${category}")`).click();
  }

  // Search interactions
  async search(query: string) {
    const searchInput = this.page.locator('[data-testid="search-input"], input[type="search"], .search-input, input[placeholder*="Search"]');
    await searchInput.fill(query);
    // Wait for debounce
    await this.page.waitForTimeout(500);
  }

  async clearSearch() {
    const searchInput = this.page.locator('[data-testid="search-input"], input[type="search"], .search-input, input[placeholder*="Search"]');
    await searchInput.clear();
  }

  // Create note
  async openCreateNoteModal() {
    await this.page.locator('[data-testid="create-note"], button:has-text("New"), button:has-text("Create"), .add-note-btn').click();
  }

  async fillNoteContent(content: string) {
    const textarea = this.page.locator('[data-testid="note-content-input"], textarea.note-content, .create-note textarea');
    await textarea.fill(content);
  }

  async submitNote() {
    await this.page.locator('[data-testid="submit-note"], button[type="submit"], button:has-text("Save")').click();
  }

  // Delete note
  async deleteCurrentNote() {
    await this.page.locator('[data-testid="delete-note"], button:has-text("Delete"), .delete-btn').click();
    // Confirm deletion
    await this.page.locator('[data-testid="confirm-delete"], button:has-text("Confirm"), button:has-text("Yes")').click();
  }

  // Edit note
  async editCurrentNote() {
    await this.page.locator('[data-testid="edit-note"], button:has-text("Edit"), .edit-btn').click();
  }

  async saveEdit() {
    await this.page.locator('[data-testid="save-edit"], button:has-text("Save"), button[type="submit"]').click();
  }

  // Q&A page
  async askQuestion(question: string) {
    const input = this.page.locator('[data-testid="question-input"], .question-input, textarea, input[placeholder*="Ask"]');
    await input.fill(question);
    await this.page.locator('[data-testid="submit-question"], button[type="submit"], button:has-text("Ask")').click();
  }

  async getAnswer() {
    return this.page.locator('[data-testid="answer"], .answer, .response');
  }
}

/**
 * Extended test fixture with helpers
 */
export const test = base.extend<{
  notesPage: NotesPage;
  apiHelper: APIHelper;
}>({
  notesPage: async ({ page }, use) => {
    const notesPage = new NotesPage(page);
    await use(notesPage);
  },
  apiHelper: async ({ request }, use) => {
    const apiHelper = new APIHelper(request);
    await use(apiHelper);
  },
});

export { expect };
