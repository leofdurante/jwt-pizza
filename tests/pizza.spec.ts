import { test, expect } from 'playwright-test-coverage';
import { mockJwtPizzaApi } from './testHelpers';

test('home page', async ({ page }) => {
  await mockJwtPizzaApi(page);
  await page.goto('/');

  await expect(page).toHaveTitle('JWT Pizza');
  await expect(page.getByRole('button', { name: 'Order now' })).toBeVisible();
});

test('login success then logout', async ({ page }) => {
  await mockJwtPizzaApi(page);
  await page.goto('/');

  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByLabel('Email address').fill('d@jwt.com');
  await page.getByLabel('Password').fill('a');
  await page.getByRole('button', { name: 'Login' }).click();

  await expect(page.getByRole('link', { name: 'KC' })).toBeVisible();

  await page.getByRole('link', { name: 'Logout' }).click();
  await expect(page.getByRole('link', { name: 'Login' })).toBeVisible();
});

test('login failure shows message', async ({ page }) => {
  await mockJwtPizzaApi(page);
  await page.goto('/login');

  await page.getByLabel('Email address').fill('d@jwt.com');
  await page.getByLabel('Password').fill('wrong');
  await page.getByRole('button', { name: 'Login' }).click();

  await expect(page.getByText(/Unauthorized|401/)).toBeVisible();
});

test('register creates a diner session', async ({ page }) => {
  await mockJwtPizzaApi(page);
  await page.goto('/register');

  await page.getByPlaceholder('Full name').fill('New User');
  await page.getByPlaceholder('Email address').fill('new@jwt.com');
  await page.getByPlaceholder('Password').fill('pw');
  await page.getByRole('button', { name: 'Register' }).click();

  await expect(page.getByRole('link', { name: 'NU' })).toBeVisible();
});

test('purchase with login and verify', async ({ page }) => {
  await mockJwtPizzaApi(page);
  await page.goto('/');

  await page.getByRole('button', { name: 'Order now' }).click();
  await expect(page.getByRole('heading', { level: 2 })).toContainText('Awesome is a click away');

  await page.getByRole('combobox').selectOption('4');
  await page.getByRole('button', { name: /Veggie/ }).click();
  await page.getByRole('button', { name: /Pepperoni/ }).click();
  await expect(page.getByText('Selected pizzas: 2')).toBeVisible();

  await page.getByRole('button', { name: 'Checkout' }).click();

  await page.getByLabel('Email address').fill('d@jwt.com');
  await page.getByLabel('Password').fill('a');
  await page.getByRole('button', { name: 'Login' }).click();

  await expect(page.getByText('Send me those 2 pizzas right now!')).toBeVisible();
  await expect(page.locator('tbody')).toContainText('Veggie');
  await expect(page.locator('tbody')).toContainText('Pepperoni');
  await expect(page.locator('tfoot')).toContainText('0.008');

  await page.getByRole('button', { name: 'Pay now' }).click();
  await expect(page.getByText('order ID:')).toBeVisible();
  await expect(page.getByText('23')).toBeVisible();

  await page.getByRole('button', { name: 'Verify' }).click();
  await expect(page.getByText('valid', { exact: true })).toBeVisible();
});

test('diner dashboard shows order history', async ({ page }) => {
  await mockJwtPizzaApi(page, {
    initialUserEmail: 'd@jwt.com',
    orderHistory: {
      id: 'history-1',
      dinerId: '3',
      orders: [
        { id: '101', franchiseId: '2', storeId: '4', date: '2026-01-01T00:00:00.000Z', items: [{ menuId: '1', description: 'Veggie', price: 0.0038 }] },
      ],
    },
  });
  await page.goto('/diner-dashboard');

  await expect(page.getByText('Your pizza kitchen')).toBeVisible();
  await expect(page.locator('tbody')).toContainText('101');
});

test('admin dashboard renders for admins', async ({ page }) => {
  await mockJwtPizzaApi(page, { initialUserEmail: 'a@jwt.com' });
  await page.goto('/admin-dashboard');

  await expect(page.getByText("Mama Ricci's kitchen")).toBeVisible();
  await expect(page.getByText('Franchises')).toBeVisible();
  await expect(page.locator('table').first()).toContainText('LotaPizza');
});

test('docs page loads', async ({ page }) => {
  await mockJwtPizzaApi(page);
  await page.goto('/docs');

  await expect(page.getByText('JWT Pizza API')).toBeVisible();
  await expect(page.getByText('[GET] /api/order/menu')).toBeVisible();
});

test('static pages and not found route', async ({ page }) => {
  await mockJwtPizzaApi(page);

  await page.goto('/about');
  await expect(page.getByRole('heading', { name: 'The secret sauce' })).toBeVisible();

  await page.goto('/history');
  await expect(page.getByRole('heading', { name: 'Mama Rucci, my my' })).toBeVisible();

  await page.goto('/definitely-not-a-route');
  await expect(page.getByRole('heading', { level: 2, name: 'Oops' })).toBeVisible();
});

test('franchise dashboard explains franchise program when logged out', async ({ page }) => {
  await mockJwtPizzaApi(page);
  await page.goto('/franchise-dashboard');

  await expect(page.getByText('So you want a piece of the pie?')).toBeVisible();
  await expect(page.getByText('Call now')).toBeVisible();
});

test('franchise dashboard shows stores for franchisees', async ({ page }) => {
  await mockJwtPizzaApi(page, {
    initialUserEmail: 'f@jwt.com',
    franchiseByUser: [
      {
        id: 99,
        name: 'FranCo',
        admins: [{ email: 'f@jwt.com', name: 'Fran Chisee' }],
        stores: [{ id: 501, name: 'Downtown', totalRevenue: 9.99 }],
      },
    ],
  });

  await page.goto('/franchise-dashboard');
  await expect(page.getByText('FranCo')).toBeVisible();
  await expect(page.locator('table')).toContainText('Downtown');
});

test('menu requires store and pizza selection before checkout', async ({ page }) => {
  await mockJwtPizzaApi(page);
  await page.goto('/menu');

  const checkout = page.getByRole('button', { name: 'Checkout' });
  await expect(checkout).toBeDisabled();

  await page.getByRole('combobox').selectOption('4');
  await expect(checkout).toBeDisabled();

  await page.getByRole('button', { name: /Veggie/ }).click();
  await expect(checkout).toBeEnabled();
});

test('payment cancel returns to menu with order preserved', async ({ page }) => {
  await mockJwtPizzaApi(page, { initialUserEmail: 'd@jwt.com' });
  await page.goto('/menu');

  await page.getByRole('combobox').selectOption('4');
  await page.getByRole('button', { name: /Veggie/ }).click();
  await page.getByRole('button', { name: 'Checkout' }).click();

  await expect(page.getByText('Send me that pizza right now!')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();

  await expect(page.getByText('Selected pizzas: 1')).toBeVisible();
});

test('admin franchise filter triggers a refresh', async ({ page }) => {
  await mockJwtPizzaApi(page, { initialUserEmail: 'a@jwt.com' });
  await page.goto('/admin-dashboard');

  await page.getByPlaceholder('Filter franchises').fill('Lota');
  await page.getByPlaceholder('Filter franchises').locator('..').getByRole('button', { name: 'Submit' }).click();
  await expect(page.locator('table').first()).toContainText('LotaPizza');
});

test('docs factory route loads', async ({ page }) => {
  await mockJwtPizzaApi(page);
  await page.goto('/docs/factory');

  await expect(page.getByText('JWT Pizza API')).toBeVisible();
});
