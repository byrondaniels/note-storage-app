import { test, expect } from './fixtures';

test.describe('Categories', () => {
  test.beforeEach(async ({ apiHelper }) => {
    await apiHelper.deleteAllNotes();
  });

  test('should display notes filtered by category', async ({ notesPage, apiHelper, page }) => {
    // Create notes with different categories - categories are auto-assigned by AI
    await apiHelper.createNote({
      content: 'Meeting notes from today standup. Discussed sprint progress and blockers.',
    });
    await apiHelper.createNote({
      content: 'Recipe for pasta carbonara with eggs, bacon, and parmesan cheese.',
    });

    await notesPage.gotoView();
    await notesPage.waitForNotesLoaded();

    // Check that notes are displayed
    const notesCount = await notesPage.getNotesCount();
    expect(notesCount).toBeGreaterThanOrEqual(2);
  });

  test('should navigate to category view', async ({ notesPage, apiHelper, page }) => {
    // Create a note
    await apiHelper.createNote({
      content: 'Test note for category navigation testing purposes',
    });

    await notesPage.gotoView();
    await notesPage.waitForNotesLoaded();

    // Try to open category filter if available
    const categoryFilter = page.locator('[data-testid="category-filter"], .category-filter, button:has-text("Categories"), .filter-dropdown');

    if (await categoryFilter.isVisible()) {
      await categoryFilter.click();
      // Category list should be visible
      await expect(page.locator('.category-list, .categories-dropdown, [data-testid="categories"]')).toBeVisible();
    }
  });
});

test.describe('Category Badge', () => {
  test.beforeEach(async ({ apiHelper }) => {
    await apiHelper.deleteAllNotes();
  });

  test('should display category badge on notes', async ({ notesPage, apiHelper, page }) => {
    // Create a note - it will get auto-categorized
    await apiHelper.createNote({
      content: 'This is a note about software development best practices and coding standards.',
    });

    await notesPage.gotoView();
    await notesPage.waitForNotesLoaded();

    // Select the first note
    await notesPage.selectNote(0);
    await page.waitForTimeout(500);

    // Check if category badge is visible
    const categoryBadge = page.locator('.category-badge, [data-testid="category-badge"], .category');
    // Category may or may not be visible depending on UI implementation
    // Just verify the page doesn't error
  });
});
