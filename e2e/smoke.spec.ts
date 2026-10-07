import { test, expect } from '@playwright/test';

test('the app shell responds on the root route', async ({ page }) => {
  const response = await page.goto('/');
  expect(response?.status()).toBeLessThan(500);
});
