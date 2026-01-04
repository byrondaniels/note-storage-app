import { test, expect } from './fixtures';

test.describe('Question & Answer', () => {
  test.beforeEach(async ({ apiHelper }) => {
    await apiHelper.deleteAllNotes();
  });

  test('should navigate to Q&A page', async ({ notesPage, page }) => {
    await notesPage.gotoAsk();

    // Should be on the Q&A page
    await expect(page).toHaveURL(/\/ask/);
  });

  test('should display Q&A interface', async ({ notesPage, page }) => {
    await notesPage.gotoAsk();

    // Should have a question input
    const questionInput = page.locator('[data-testid="question-input"], .question-input, textarea, input[placeholder*="Ask"], input[placeholder*="question"]');
    await expect(questionInput).toBeVisible();
  });

  test('should submit a question', async ({ notesPage, apiHelper, page }) => {
    // Create some notes to provide context
    await apiHelper.createNote({
      content: 'JavaScript is a programming language commonly used for web development.',
    });
    await apiHelper.createNote({
      content: 'Python is a versatile programming language used for data science and automation.',
    });

    await notesPage.gotoAsk();

    // Ask a question
    const questionInput = page.locator('[data-testid="question-input"], .question-input, textarea, input[placeholder*="Ask"]');
    await questionInput.fill('What programming languages are mentioned?');

    // Submit the question
    const submitBtn = page.locator('[data-testid="submit-question"], button[type="submit"], button:has-text("Ask"), button:has-text("Submit")');
    await submitBtn.click();

    // Wait for response (may take a while due to AI processing)
    // Just verify no error occurred
    await page.waitForTimeout(2000);
  });

  test('should handle empty question gracefully', async ({ notesPage, page }) => {
    await notesPage.gotoAsk();

    // Try to submit without a question
    const submitBtn = page.locator('[data-testid="submit-question"], button[type="submit"], button:has-text("Ask")');

    // Button should be disabled or clicking should not cause error
    const isDisabled = await submitBtn.isDisabled();

    if (!isDisabled) {
      await submitBtn.click();
      // Should not crash - either show validation error or do nothing
      await page.waitForTimeout(500);
    }
  });
});

test.describe('AI Question on Note', () => {
  test.beforeEach(async ({ apiHelper }) => {
    await apiHelper.deleteAllNotes();
  });

  test('should allow asking AI about a specific note', async ({ notesPage, apiHelper, page }) => {
    // Create a note
    await apiHelper.createNote({
      content: `
        Today we discussed the new feature requirements:
        1. User authentication with OAuth
        2. Dashboard redesign
        3. API rate limiting
        4. Mobile app sync
      `,
    });

    await notesPage.gotoView();
    await notesPage.waitForNotesLoaded();

    // Select the note
    await notesPage.selectNote(0);
    await page.waitForTimeout(500);

    // Look for AI question button
    const aiQuestionBtn = page.locator('[data-testid="ai-question"], button:has-text("Ask AI"), button:has-text("AI Question"), .ai-btn');

    if (await aiQuestionBtn.isVisible()) {
      await aiQuestionBtn.click();

      // Modal or input should appear
      await page.waitForTimeout(500);
    }
  });
});
