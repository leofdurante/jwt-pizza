import http from 'k6/http';
import { check, fail, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '1m', target: 10 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<1500'],
  },
};

const serviceUrl = __ENV.PIZZA_SERVICE_URL || 'https://pizza-service.cs329pizzawebsite.click';
const factoryUrl = __ENV.PIZZA_FACTORY_URL || 'https://pizza-factory.cs329.click';
const siteOrigin = __ENV.PIZZA_SITE_ORIGIN || 'https://pizza.cs329pizzawebsite.click';
const userEmail = __ENV.PIZZA_USER_EMAIL || 'd@jwt.com';
const userPassword = __ENV.PIZZA_USER_PASSWORD || 'a';

function mustPass(response, label) {
  if (!check(response, { [`${label} status is 200`]: (r) => r.status === 200 })) {
    console.log(`${label} failed with status ${response.status}`);
    console.log(response.body);
    fail(`${label} was not HTTP 200`);
  }
}

export default function () {
  const vars = {};

  // 1) Login
  let response = http.put(
    `${serviceUrl}/api/auth`,
    JSON.stringify({ email: userEmail, password: userPassword }),
    {
      headers: {
        accept: '*/*',
        'content-type': 'application/json',
        origin: siteOrigin,
      },
    }
  );
  mustPass(response, 'Login');
  vars.authToken = response.json('token');
  if (!vars.authToken) {
    console.log(response.body);
    fail('Missing auth token from login response');
  }

  sleep(1);

  // 2) Navigate menu (menu + franchises emulate checkout flow)
  response = http.get(`${serviceUrl}/api/order/menu`, {
    headers: {
      accept: '*/*',
      authorization: `Bearer ${vars.authToken}`,
      origin: siteOrigin,
    },
  });
  mustPass(response, 'Get menu');
  const menu = response.json();
  const firstPizza = Array.isArray(menu) && menu.length > 0 ? menu[0] : null;
  if (!firstPizza?.id || typeof firstPizza.price !== 'number') {
    fail('Menu response missing required pizza data');
  }

  response = http.get(`${serviceUrl}/api/franchise?page=1&limit=10&name=*`, {
    headers: {
      accept: '*/*',
      authorization: `Bearer ${vars.authToken}`,
      origin: siteOrigin,
    },
  });
  mustPass(response, 'Get franchises');
  const franchiseId = response.json('franchises.0.id');
  const storeId = response.json('franchises.0.stores.0.id');
  if (!franchiseId || !storeId) {
    fail('Franchise response missing franchise/store IDs');
  }

  sleep(1);

  // 3) Buy pizza
  const orderPayload = {
    franchiseId,
    storeId,
    items: [{ menuId: firstPizza.id, description: firstPizza.description, price: firstPizza.price }],
  };
  response = http.post(`${serviceUrl}/api/order`, JSON.stringify(orderPayload), {
    headers: {
      accept: '*/*',
      authorization: `Bearer ${vars.authToken}`,
      'content-type': 'application/json',
      origin: siteOrigin,
    },
  });
  mustPass(response, 'Purchase');

  // 4) Verify pizza JWT from THIS purchase response (not hard-coded)
  vars.orderJwt = response.json('jwt');
  if (!vars.orderJwt) {
    console.log(response.body);
    fail('Missing order JWT from purchase response');
  }

  response = http.post(
    `${factoryUrl}/api/order/verify`,
    JSON.stringify({ jwt: vars.orderJwt }),
    {
      headers: {
        accept: '*/*',
        'content-type': 'application/json',
        origin: siteOrigin,
      },
    }
  );
  mustPass(response, 'Verify pizza');

  sleep(1);
}
