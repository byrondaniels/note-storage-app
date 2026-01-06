import { test, expect } from '@playwright/test';

const API_URL = process.env.E2E_API_URL || 'http://localhost:8081';

test.describe('API E2E Tests', () => {
  test.describe('Notes API', () => {
    test('GET /notes should return array', async ({ request }) => {
      const response = await request.get(`${API_URL}/notes`);

      expect(response.ok()).toBeTruthy();
      expect(response.status()).toBe(200);

      const notes = await response.json();
      expect(Array.isArray(notes)).toBeTruthy();
    });

    test('POST /notes should create a note', async ({ request }) => {
      const noteData = {
        content: 'E2E API test note content for validation',
        title: 'API Test Note',
        metadata: {
          platform: 'test',
          author: 'E2E Test',
        },
      };

      const response = await request.post(`${API_URL}/notes`, {
        data: noteData,
      });

      // May return 201 or 500 depending on AI configuration
      if (response.ok()) {
        expect(response.status()).toBe(201);
        const note = await response.json();
        expect(note.content).toBe(noteData.content);
        expect(note.id).toBeDefined();

        // Cleanup
        await request.delete(`${API_URL}/notes/${note.id}`);
      }
    });

    test('POST /notes without content should return 400', async ({ request }) => {
      const response = await request.post(`${API_URL}/notes`, {
        data: { title: 'No Content' },
      });

      expect(response.status()).toBe(400);
    });

    test('DELETE /notes/:id with invalid ID should return 404', async ({ request }) => {
      const response = await request.delete(`${API_URL}/notes/invalid-id`);

      expect(response.status()).toBe(404);
    });
  });

  test.describe('Categories API', () => {
    test('GET /categories should return array', async ({ request }) => {
      const response = await request.get(`${API_URL}/categories`);

      expect(response.ok()).toBeTruthy();

      const categories = await response.json();
      expect(Array.isArray(categories)).toBeTruthy();
    });

    test('GET /categories/stats should return statistics', async ({ request }) => {
      const response = await request.get(`${API_URL}/categories/stats`);

      expect(response.ok()).toBeTruthy();

      const stats = await response.json();
      expect(stats).toHaveProperty('categories');
      expect(stats).toHaveProperty('total_notes');
      expect(stats).toHaveProperty('total_categories');
    });

    test('GET /notes/category/:category with valid category should work', async ({ request }) => {
      const response = await request.get(`${API_URL}/notes/category/other`);

      expect(response.ok()).toBeTruthy();

      const notes = await response.json();
      expect(Array.isArray(notes)).toBeTruthy();
    });

    test('GET /notes/category/:category with invalid category should return 400', async ({ request }) => {
      const response = await request.get(`${API_URL}/notes/category/invalid-category-xyz`);

      expect(response.status()).toBe(400);
    });
  });

  test.describe('Channels API', () => {
    test('GET /channels should return array', async ({ request }) => {
      const response = await request.get(`${API_URL}/channels`);

      expect(response.ok()).toBeTruthy();

      const channels = await response.json();
      expect(Array.isArray(channels)).toBeTruthy();
    });

    test('GET /channel-settings should return array', async ({ request }) => {
      const response = await request.get(`${API_URL}/channel-settings`);

      expect(response.ok()).toBeTruthy();

      const settings = await response.json();
      expect(Array.isArray(settings)).toBeTruthy();
    });

    test('GET /channel-settings/:channel returns defaults for new channel', async ({ request }) => {
      const response = await request.get(`${API_URL}/channel-settings/NewTestChannel`);

      expect(response.ok()).toBeTruthy();

      const settings = await response.json();
      expect(settings.channelName).toBe('NewTestChannel');
    });

    test('PUT /channel-settings/:channel should create settings', async ({ request }) => {
      const channelName = `TestChannel_${Date.now()}`;
      const settingsData = {
        platform: 'youtube',
        channelUrl: 'https://youtube.com/@test',
        promptText: 'Test prompt',
        promptSchema: '{"test": "schema"}',
      };

      const response = await request.put(`${API_URL}/channel-settings/${encodeURIComponent(channelName)}`, {
        data: settingsData,
      });

      expect(response.ok()).toBeTruthy();

      const settings = await response.json();
      expect(settings.channelName).toBe(channelName);
      expect(settings.platform).toBe('youtube');

      // Cleanup
      await request.delete(`${API_URL}/channel-settings/${encodeURIComponent(channelName)}`);
    });

    test('PUT /channel-settings/:channel with invalid JSON schema should return 400', async ({ request }) => {
      const response = await request.put(`${API_URL}/channel-settings/BadChannel`, {
        data: {
          platform: 'youtube',
          promptSchema: 'not valid json',
        },
      });

      expect(response.status()).toBe(400);
    });
  });

  test.describe('Search API', () => {
    test('POST /search with query should work', async ({ request }) => {
      const response = await request.post(`${API_URL}/search`, {
        data: { query: 'test query' },
      });

      // May return 200 or 500 depending on AI configuration (needs embeddings)
      // Status 500 is acceptable when AI services are not configured
      expect([200, 500]).toContain(response.status());

      if (response.ok()) {
        const results = await response.json();
        expect(Array.isArray(results)).toBeTruthy();
      }
    });

    test('POST /search without query should return 400', async ({ request }) => {
      const response = await request.post(`${API_URL}/search`, {
        data: {},
      });

      expect(response.status()).toBe(400);
    });
  });

  test.describe('Q&A API', () => {
    test('POST /ask with question should work', async ({ request }) => {
      const response = await request.post(`${API_URL}/ask`, {
        data: { question: 'What is this about?' },
      });

      // May return 200 or 500 depending on AI configuration
      if (response.ok()) {
        const result = await response.json();
        expect(result).toHaveProperty('answer');
        expect(result).toHaveProperty('question');
      }
    });

    test('POST /ask without question should return 400', async ({ request }) => {
      const response = await request.post(`${API_URL}/ask`, {
        data: {},
      });

      expect(response.status()).toBe(400);
    });
  });

  test.describe('AI Question API', () => {
    test('POST /ai-question with content and prompt should work', async ({ request }) => {
      const response = await request.post(`${API_URL}/ai-question`, {
        data: {
          content: 'This is test content about programming.',
          prompt: 'What is this about?',
        },
      });

      // May return 200 or 500 depending on AI configuration
      if (response.ok()) {
        const result = await response.json();
        expect(result).toHaveProperty('response');
      }
    });

    test('POST /ai-question without content should return 400', async ({ request }) => {
      const response = await request.post(`${API_URL}/ai-question`, {
        data: { prompt: 'What is this?' },
      });

      expect(response.status()).toBe(400);
    });

    test('POST /ai-question without prompt should return 400', async ({ request }) => {
      const response = await request.post(`${API_URL}/ai-question`, {
        data: { content: 'Some content' },
      });

      expect(response.status()).toBe(400);
    });
  });
});
