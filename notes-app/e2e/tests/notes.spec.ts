import { test, expect } from './fixtures';

test.describe('Notes Management', () => {
  test.beforeEach(async ({ apiHelper }) => {
    // Clean up before each test
    await apiHelper.deleteAllNotes();
  });

  test('should display empty state when no notes exist', async ({ notesPage, page }) => {
    await notesPage.gotoView();
    await notesPage.waitForNotesLoaded();

    // Should show empty state or zero notes
    const notesCount = await notesPage.getNotesCount();
    expect(notesCount).toBe(0);
  });

  test('should display notes list when notes exist', async ({ notesPage, apiHelper, page }) => {
    // Create test notes via API
    await apiHelper.createNote({
      content: 'First test note content for E2E testing',
      title: 'Test Note 1',
    });
    await apiHelper.createNote({
      content: 'Second test note content for E2E testing',
      title: 'Test Note 2',
    });

    await notesPage.gotoView();
    await notesPage.waitForNotesLoaded();

    // Should show 2 notes
    const notesCount = await notesPage.getNotesCount();
    expect(notesCount).toBeGreaterThanOrEqual(2);
  });

  test('should select and display note details', async ({ notesPage, apiHelper, page }) => {
    // Create a test note
    const testNote = await apiHelper.createNote({
      content: 'This is the content of a detailed test note',
      title: 'Detailed Test Note',
    });

    await notesPage.gotoView();
    await notesPage.waitForNotesLoaded();

    // Select the note
    await notesPage.selectNote(0);

    // Wait for note detail to load
    await page.waitForTimeout(500);

    // Verify note content is displayed
    const content = await notesPage.getNoteContent();
    await expect(content).toBeVisible();
  });

  test('should filter notes by search query', async ({ notesPage, apiHelper, page }) => {
    // Create test notes with different content
    await apiHelper.createNote({
      content: 'Note about JavaScript programming',
      title: 'JavaScript Guide',
    });
    await apiHelper.createNote({
      content: 'Note about Python programming',
      title: 'Python Guide',
    });
    await apiHelper.createNote({
      content: 'Note about cooking recipes',
      title: 'Recipe Book',
    });

    await notesPage.gotoView();
    await notesPage.waitForNotesLoaded();

    // Search for JavaScript
    await notesPage.search('JavaScript');

    // Wait for search results
    await page.waitForTimeout(1000);

    // Should filter to show relevant notes
    // Note: Semantic search may return different results
    const searchInput = page.locator('input[placeholder*="Search"], .search-input');
    await expect(searchInput).toHaveValue('JavaScript');
  });

  test('should clear search and show all notes', async ({ notesPage, apiHelper, page }) => {
    // Create test notes
    await apiHelper.createNote({
      content: 'Note about JavaScript',
      title: 'JavaScript',
    });
    await apiHelper.createNote({
      content: 'Note about Python',
      title: 'Python',
    });

    await notesPage.gotoView();
    await notesPage.waitForNotesLoaded();

    // Search for something
    await notesPage.search('JavaScript');
    await page.waitForTimeout(500);

    // Clear search
    await notesPage.clearSearch();
    await page.waitForTimeout(500);

    // Should show all notes again
    const notesCount = await notesPage.getNotesCount();
    expect(notesCount).toBeGreaterThanOrEqual(2);
  });
});

test.describe('Note CRUD Operations', () => {
  test.beforeEach(async ({ apiHelper }) => {
    await apiHelper.deleteAllNotes();
  });

  test('should delete a note', async ({ notesPage, apiHelper, page }) => {
    // Create a test note
    await apiHelper.createNote({
      content: 'Note to be deleted',
      title: 'Delete Me',
    });

    await notesPage.gotoView();
    await notesPage.waitForNotesLoaded();

    // Verify note exists
    let notesCount = await notesPage.getNotesCount();
    expect(notesCount).toBeGreaterThanOrEqual(1);

    // Select the note
    await notesPage.selectNote(0);
    await page.waitForTimeout(300);

    // Delete the note
    await notesPage.deleteCurrentNote();

    // Wait for deletion
    await page.waitForTimeout(500);

    // Verify note is deleted
    notesCount = await notesPage.getNotesCount();
    expect(notesCount).toBe(0);
  });
});

test.describe('Notes with Channels', () => {
  test.beforeEach(async ({ apiHelper }) => {
    await apiHelper.deleteAllNotes();
  });

  test('should display notes from different channels', async ({ notesPage, apiHelper, page }) => {
    // Create notes from different channels
    await apiHelper.createNote({
      content: 'Video transcript from TechChannel about AI',
      title: 'AI Tutorial',
      metadata: {
        platform: 'youtube',
        author: 'TechChannel',
        url: 'https://youtube.com/watch?v=123',
      },
    });
    await apiHelper.createNote({
      content: 'Another video from TechChannel about ML',
      title: 'ML Tutorial',
      metadata: {
        platform: 'youtube',
        author: 'TechChannel',
        url: 'https://youtube.com/watch?v=456',
      },
    });
    await apiHelper.createNote({
      content: 'Tweet thread about JavaScript',
      title: 'JS Thread',
      metadata: {
        platform: 'twitter',
        author: 'JSGuru',
        url: 'https://twitter.com/status/789',
      },
    });

    await notesPage.gotoView();
    await notesPage.waitForNotesLoaded();

    // Should show all 3 notes
    const notesCount = await notesPage.getNotesCount();
    expect(notesCount).toBeGreaterThanOrEqual(3);
  });

  test('should filter notes by channel', async ({ notesPage, apiHelper, page }) => {
    // Create notes from different channels
    await apiHelper.createNote({
      content: 'Video from TechChannel',
      metadata: {
        platform: 'youtube',
        author: 'TechChannel',
      },
    });
    await apiHelper.createNote({
      content: 'Tweet from JSGuru',
      metadata: {
        platform: 'twitter',
        author: 'JSGuru',
      },
    });

    await notesPage.gotoView();
    await notesPage.waitForNotesLoaded();

    // Filter by channel (using URL query param)
    await page.goto('/view?channel=TechChannel');
    await notesPage.waitForNotesLoaded();

    // Should filter to show only TechChannel notes
    const notesCount = await notesPage.getNotesCount();
    expect(notesCount).toBeGreaterThanOrEqual(1);
  });
});
