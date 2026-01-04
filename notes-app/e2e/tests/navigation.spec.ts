import { test, expect } from './fixtures';

test.describe('Navigation', () => {
  test('should load the home page', async ({ page }) => {
    await page.goto('/');

    // Page should load without errors
    await expect(page).toHaveTitle(/Notes|note/i);
  });

  test('should navigate to view notes page', async ({ notesPage, page }) => {
    await notesPage.gotoView();

    await expect(page).toHaveURL(/\/view/);
  });

  test('should navigate to Q&A page', async ({ notesPage, page }) => {
    await notesPage.gotoAsk();

    await expect(page).toHaveURL(/\/ask/);
  });

  test('should navigate to settings page', async ({ notesPage, page }) => {
    await notesPage.gotoSettings();

    await expect(page).toHaveURL(/\/settings/);
  });

  test('should have working navigation links', async ({ page }) => {
    await page.goto('/');

    // Look for navigation links
    const navLinks = page.locator('nav a, .navbar a, header a');
    const count = await navLinks.count();

    // Should have at least one nav link
    expect(count).toBeGreaterThan(0);
  });

  test('should navigate between pages using nav links', async ({ page }) => {
    await page.goto('/');

    // Find and click on View/Notes link
    const viewLink = page.locator('nav a:has-text("View"), nav a:has-text("Notes"), a[href="/view"]').first();

    if (await viewLink.isVisible()) {
      await viewLink.click();
      await expect(page).toHaveURL(/\/view/);
    }

    // Navigate to Q&A
    const askLink = page.locator('nav a:has-text("Ask"), nav a:has-text("Q&A"), a[href="/ask"]').first();

    if (await askLink.isVisible()) {
      await askLink.click();
      await expect(page).toHaveURL(/\/ask/);
    }
  });
});

test.describe('Smoke Tests', () => {
  test('should load CSS and JS assets', async ({ page }) => {
    await page.goto('/');

    // Check that Vue app is mounted
    const app = page.locator('#app');
    await expect(app).toBeVisible();
  });

  test('should not have JavaScript errors on load', async ({ page }) => {
    const errors: string[] = [];

    page.on('pageerror', (error) => {
      errors.push(error.message);
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // No critical errors should occur
    const criticalErrors = errors.filter(
      (e) => !e.includes('ResizeObserver') && !e.includes('non-critical')
    );

    expect(criticalErrors.length).toBe(0);
  });

  test('should have responsive layout', async ({ page }) => {
    await page.goto('/');

    // Test desktop size
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(page.locator('#app')).toBeVisible();

    // Test tablet size
    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(page.locator('#app')).toBeVisible();

    // Test mobile size
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('#app')).toBeVisible();
  });

  test('should handle network errors gracefully', async ({ page }) => {
    // Go to page first
    await page.goto('/view');

    // Simulate offline
    await page.context().setOffline(true);

    // Try to interact - should not crash
    await page.waitForTimeout(500);

    // Back online
    await page.context().setOffline(false);

    // Should recover
    await page.reload();
    await expect(page.locator('#app')).toBeVisible();
  });
});
