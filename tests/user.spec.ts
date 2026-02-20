import { test, expect } from 'playwright-test-coverage';
import { mockJwtPizzaApi } from './testHelpers';

test('updateUser', async ({ page }) => {
  await mockJwtPizzaApi(page);
  const email = `user${Math.floor(Math.random() * 10000)}@jwt.com`;
  await page.goto('/');
  await page.getByRole('link', { name: 'Register' }).click();
  await page.getByPlaceholder('Full name').fill('pizza diner');
  await page.getByPlaceholder('Email address').fill(email);
  await page.getByPlaceholder('Password').fill('diner');
  await page.getByRole('button', { name: 'Register' }).click();

  await expect(page.getByRole('link', { name: 'pd' })).toBeVisible();
  await page.getByRole('link', { name: 'pd' }).click();

  await page.getByRole('button', { name: 'Edit' }).click();
  await expect(page.locator('h3')).toContainText('Edit user');
  await page.getByRole('textbox').first().fill('pizza dinerx');
  await page.getByRole('button', { name: 'Update' }).click();

  await page.waitForSelector('[role="dialog"].hidden', { state: 'attached' });

  await expect(page.getByRole('main')).toContainText('pizza dinerx');

  await page.getByRole('link', { name: 'Logout' }).click();
  await page.getByRole('link', { name: 'Login' }).click();

  await page.getByPlaceholder('Email address').fill(email);
  await page.getByPlaceholder('Password').fill('diner');
  await page.getByRole('button', { name: 'Login' }).click();

  await page.locator('a[href="/diner-dashboard"]').first().click();

  await expect(page.getByRole('main')).toContainText('pizza dinerx');
});

test('list users', async ({ page }) => {
  await mockJwtPizzaApi(page, { initialUserEmail: 'a@jwt.com' });
  await page.goto('/admin-dashboard');

  await expect(page.getByText('Users')).toBeVisible();
  await expect(page.getByText('Name')).toBeVisible();
  await expect(page.getByText('Email')).toBeVisible();
  await expect(page.getByText('Role')).toBeVisible();
  await expect(page.locator('table').filter({ hasText: 'Name' })).toContainText('Kai Chen');
  await expect(page.locator('table').filter({ hasText: 'Name' })).toContainText('Admin User');
});

test('list users filter by name', async ({ page }) => {
  await mockJwtPizzaApi(page, { initialUserEmail: 'a@jwt.com' });
  await page.goto('/admin-dashboard');

  await page.getByPlaceholder('Filter users').fill('Kai');
  await page.locator('input[placeholder="Filter users"]').locator('..').getByRole('button', { name: 'Submit' }).click();

  await expect(page.locator('table').filter({ hasText: 'Name' })).toContainText('Kai Chen');
});

test('delete user', async ({ page }) => {
  page.on('dialog', (dialog) => dialog.accept());
  await mockJwtPizzaApi(page, { initialUserEmail: 'a@jwt.com' });
  await page.goto('/admin-dashboard');

  const usersTable = page.locator('table').filter({ hasText: 'Name' });
  await expect(usersTable).toContainText('Kai Chen');
  await page.getByRole('button', { name: 'Delete' }).first().click();
  await expect(usersTable).not.toContainText('Kai Chen');
});