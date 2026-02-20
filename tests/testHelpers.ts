import type { Page } from '@playwright/test';

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
  const { password: _password, ...rest } = user;
  return rest;
}

export async function mockJwtPizzaApi(
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
  const registeredUsers: Record<string, { password: string; user: Omit<User, 'password'> }> = {};
  const deletedUserIds = new Set<string | number>();

  if (options.initialUserEmail) {
    await page.addInitScript(() => window.localStorage.setItem('token', 'token-for-tests'));
  }

  await page.route('*/**/api/auth', async (route) => {
    const method = route.request().method();

    if (method === 'PUT') {
      const req = route.request().postDataJSON() as { email: string; password: string };
      const user = users[req.email];
      const registered = registeredUsers[req.email];
      if (user && user.password === req.password) {
        loggedInUser = sanitizeUser(user);
        await route.fulfill({ json: { user: loggedInUser, token: 'abcdef' } });
      } else if (registered && registered.password === req.password) {
        loggedInUser = registered.user;
        await route.fulfill({ json: { user: loggedInUser, token: 'abcdef' } });
      } else {
        await route.fulfill({ status: 401, json: { message: 'Unauthorized' } });
      }
      return;
    }

    if (method === 'POST') {
      const req = route.request().postDataJSON() as { name: string; email: string; password: string };
      loggedInUser = { id: 42, name: req.name, email: req.email, roles: [{ role: 'diner' }] };
      registeredUsers[req.email] = { password: req.password, user: loggedInUser };
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
    await route.fulfill({ json: loggedInUser });
  });

  await page.route(
    (url) => url.pathname === '/api/user' && url.search.includes('page='),
    async (route) => {
      if (route.request().method() === 'GET') {
        const allUsers = [...Object.values(users).map(sanitizeUser), ...Object.values(registeredUsers).map((r) => r.user)].filter((u) => !deletedUserIds.has(u.id!));
        const params = new URL(route.request().url()).searchParams;
        const page = parseInt(params.get('page') || '1', 10);
        const limit = parseInt(params.get('limit') || '10', 10);
        const nameFilter = params.get('name') || '*';
        let filtered = allUsers;
        if (nameFilter !== '*') {
          const pattern = nameFilter.replace(/\*/g, '.*').toLowerCase();
          const re = new RegExp(pattern);
          filtered = allUsers.filter((u) => re.test((u.name || '').toLowerCase()) || re.test((u.email || '').toLowerCase()));
        }
        const start = (page - 1) * limit;
        const pageUsers = filtered.slice(start, start + limit);
        const more = start + pageUsers.length < filtered.length;
        await route.fulfill({ json: { users: pageUsers, more } });
      } else {
        await route.fulfill({ status: 405, json: { message: 'Method not allowed' } });
      }
    }
  );

  await page.route(
    (url) => /\/api\/user\/\d+$/.test(url.pathname),
    async (route) => {
    const method = route.request().method();
    if (method === 'PUT') {
      const body = route.request().postDataJSON() as { id: number; name?: string; email?: string; password?: string; roles?: UserRole[] };
      loggedInUser = {
        id: body.id ?? loggedInUser?.id ?? 42,
        name: body.name ?? loggedInUser?.name,
        email: body.email ?? loggedInUser?.email,
        roles: body.roles ?? loggedInUser?.roles ?? [{ role: 'diner' }],
      };
      const email = body.email ?? loggedInUser?.email;
      if (email && registeredUsers[email]) {
        registeredUsers[email] = {
          ...registeredUsers[email],
          user: loggedInUser,
          password: body.password ?? registeredUsers[email].password,
        };
      }
      await route.fulfill({ json: { user: loggedInUser, token: 'abcdef' } });
    } else if (method === 'DELETE') {
      const match = route.request().url().match(/\/api\/user\/(\d+)$/);
      if (match) deletedUserIds.add(parseInt(match[1], 10));
      await route.fulfill({ status: 200, json: { message: 'ok' } });
    } else {
      await route.fulfill({ status: 405, json: { message: 'Method not allowed' } });
    }
  });

  await page.route('*/**/api/order/menu', async (route) => {
    await route.fulfill({ json: options.menu ?? defaultMenu });
  });

  await page.route(/\/api\/franchise(\?.*)?$/, async (route) => {
    await route.fulfill({ json: options.franchiseList ?? defaultFranchiseList });
  });

  await page.route(/\/api\/franchise\/\d+$/, async (route) => {
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
    await route.fulfill({ json: { message: 'valid', payload: { orderId: 23 } } });
  });

  await page.route('*/**/api/docs', async (route) => {
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
