import { test, expect, Page } from 'playwright-test-coverage';

type RoleName = 'diner' | 'franchisee' | 'admin';
type UserRole = { role: RoleName; objectId?: string };
type User = { id: number; name: string; email: string; roles: UserRole[]; password?: string };
type Pizza = { id: string | number; title: string; image: string; price: number; description: string };
type Store = { id: string | number; name: string; totalRevenue?: number };
type Franchise = { id: string | number; name: string; stores: Store[]; admins?: { email: string; id?: string; name?: string }[] };

const users: Record<string, User> = {
  'd@jwt.com': { id: 3, name: 'Kai Chen', email: 'd@jwt.com', password: 'a', roles: [{ role: 'diner' }] },
  'f@jwt.com': { id: 7, name: 'Fran Chisee', email: 'f@jwt.com', password: 'franchisee', roles: [{ role: 'franchisee', objectId: '99' }] },
  'a@jwt.com': { id: 1, name: 'Admin User', email: 'a@jwt.com', password: 'admin', roles: [{ role: 'admin' }] },
};

const defaultMenu: Pizza[] = [
  { id: 1, title: 'Veggie', image: 'pizza1.png', price: 0.0038, description: 'A garden of delight' },
  { id: 2, title: 'Pepperoni', image: 'pizza2.png', price: 0.0042, description: 'Spicy treat' },
];

const defaultFranchiseList = {
  franchises: [
    {
      id: 2,
      name: 'LotaPizza',
      admins: [{ email: 'f@jwt.com', name: 'Fran Chisee' }],
      stores: [
        { id: 4, name: 'Lehi', totalRevenue: 123.45 },
        { id: 5, name: 'Springville', totalRevenue: 67.89 },
      ],
    },
  ] satisfies Franchise[],
  more: false,
};

function sanitizeUser(user: User): Omit<User, 'password'> {
  // The frontend never receives passwords; keep mocked responses realistic.
  const { password: _password, ...rest } = user;
  return rest;
}

async function mockJwtPizzaApi(
  page: Page,
  options: {
    initialUserEmail?: keyof typeof users;
    menu?: Pizza[];
    franchiseList?: typeof defaultFranchiseList;
    franchiseByUser?: Franchise[];
    orderHistory?: { id: string; dinerId: string; orders: any[] };
  } = {}
) {
  let loggedInUser: Omit<User, 'password'> | null = options.initialUserEmail ? sanitizeUser(users[options.initialUserEmail]) : null;

  if (options.initialUserEmail) {
    // App uses localStorage token presence to decide whether to call /api/user/me.
    await page.addInitScript(() => window.localStorage.setItem('token', 'token-for-tests'));
  }

  await page.route('*/**/api/auth', async (route) => {
    const method = route.request().method();

    if (method === 'PUT') {
      const req = route.request().postDataJSON() as { email: string; password: string };
      const user = users[req.email];
      if (!user || user.password !== req.password) {
        await route.fulfill({ status: 401, json: { message: 'Unauthorized' } });
        return;
      }
      loggedInUser = sanitizeUser(user);
      await route.fulfill({ json: { user: loggedInUser, token: 'abcdef' } });
      return;
    }

    if (method === 'POST') {
      const req = route.request().postDataJSON() as { name: string; email: string; password: string };
      loggedInUser = { id: 42, name: req.name, email: req.email, roles: [{ role: 'diner' }] };
      await route.fulfill({ json: { user: loggedInUser, token: 'abcdef' } });
      return;
    }

    if (method === 'DELETE') {
      loggedInUser = null;
      await route.fulfill({ status: 200, json: { message: 'ok' } });
      return;
    }

    await route.fulfill({ status: 405, json: { message: 'Method not allowed' } });
  });

  await page.route('*/**/api/user/me', async (route) => {
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ json: loggedInUser });
  });

  await page.route('*/**/api/order/menu', async (route) => {
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ json: options.menu ?? defaultMenu });
  });

  await page.route(/\/api\/franchise(\?.*)?$/, async (route) => {
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ json: options.franchiseList ?? defaultFranchiseList });
  });

  await page.route(/\/api\/franchise\/\d+$/, async (route) => {
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ json: options.franchiseByUser ?? (options.franchiseList ?? defaultFranchiseList).franchises });
  });

  await page.route('*/**/api/order', async (route) => {
    const method = route.request().method();

    if (method === 'GET') {
      await route.fulfill({
        json:
          options.orderHistory ??
          ({
            id: 'history-1',
            dinerId: loggedInUser?.id?.toString?.() ?? '0',
            orders: [],
          } as any),
      });
      return;
    }

    if (method === 'POST') {
      const orderReq = route.request().postDataJSON() as any;
      await route.fulfill({
        json: {
          order: { ...orderReq, id: '23', date: new Date('2026-01-01T00:00:00.000Z').toISOString() },
          jwt: 'eyJpYXQ',
        },
      });
      return;
    }

    await route.fulfill({ status: 405, json: { message: 'Method not allowed' } });
  });

  await page.route('*/**/api/order/verify', async (route) => {
    expect(route.request().method()).toBe('POST');
    await route.fulfill({ json: { message: 'valid', payload: { orderId: 23 } } });
  });

  await page.route('*/**/api/docs', async (route) => {
    expect(route.request().method()).toBe('GET');
    await route.fulfill({
      json: {
        endpoints: [
          {
            requiresAuth: false,
            method: 'GET',
            path: '/api/order/menu',
            description: 'Get menu',
            example: 'curl /api/order/menu',
            response: defaultMenu,
          },
        ],
      },
    });
  });
}

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
  await expect(page.locator('table')).toContainText('LotaPizza');
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
  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.locator('table')).toContainText('LotaPizza');
});

test('docs factory route loads', async ({ page }) => {
  await mockJwtPizzaApi(page);
  await page.goto('/docs/factory');

  await expect(page.getByText('JWT Pizza API')).toBeVisible();
});
