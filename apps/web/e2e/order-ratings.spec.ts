import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { registerCustomerViaApi } from "./auth";

// KAN-9: a customer rates their delivered order from My Orders.
// Every test creates its own customer and order through the API, so tests don't
// depend on each other or on execution order. No fixed waits: the dev backend
// adds random latency, so we wait for state (visible text, API responses).

const API = process.env.VITE_API_BASE_URL || "http://localhost:8081";
const PASSWORD = "secret123";

async function createOrder(request: APIRequestContext, token: string): Promise<string> {
  const chefs = await (await request.get(`${API}/api/chef/active?page=0&size=12`)).json();
  const chef = chefs.exploreChefResponseDtoList[0];
  const detail = await (await request.get(`${API}/api/chef/${chef.id}`)).json();
  const dish = detail.dishes[0];
  expect(dish, "seed must contain at least one active dish").toBeTruthy();

  const res = await request.post(`${API}/api/order`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      chefId: chef.id,
      receiverName: "Rating E2E",
      receiverPhoneNumber: "+37490000000",
      receiverEmail: "rating-e2e@example.com",
      paymentType: "CASH",
      deliveryMethod: "TAKEAWAY",
      note: "rating e2e",
      createOrderDishes: [{ dishId: dish.id, quantity: Math.max(1, dish.minimumOrderCount ?? 1) }],
    },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).number as string;
}

async function setStatusAsAdmin(request: APIRequestContext, orderNumber: string, statuses: string[]) {
  const login = await request.post(`${API}/admin/auth/login`, {
    data: { username: "admin", password: "admin123" },
  });
  expect(login.ok()).toBeTruthy();
  const { token } = await login.json();
  const order = await (await request.get(`${API}/api/order/number/${orderNumber}`)).json();
  for (const status of statuses) {
    const res = await request.patch(`${API}/admin/order/${order.id}/status`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { status },
    });
    expect(res.ok()).toBeTruthy();
  }
}

async function createDeliveredOrder(request: APIRequestContext, token: string): Promise<string> {
  const number = await createOrder(request, token);
  await setStatusAsAdmin(request, number, ["ACCEPTED", "DELIVERED"]);
  return number;
}

/** Signs in through the UI and waits for My Orders to list the order. */
async function signInToMyOrders(page: Page, email: string, orderNumber: string) {
  await page.goto("/login?next=/orders");
  const form = page.getByRole("form", { name: "Sign in" });
  await form.getByLabel("Email").fill(email);
  await form.getByLabel("Password").fill(PASSWORD);
  await form.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/orders$/);
  await expect(orderRow(page, orderNumber)).toBeVisible();
}

const orderRow = (page: Page, orderNumber: string) => page.getByTestId(`order-${orderNumber}`);
const rateButton = (page: Page, orderNumber: string) =>
  orderRow(page, orderNumber).getByRole("button", { name: "Rate order" });

test("customer rates a delivered order and still sees the rating after reload", async ({ page, request }) => {
  const { token, email } = await registerCustomerViaApi(request, API);
  const orderNumber = await createDeliveredOrder(request, token);
  const comment = `Great food ${Date.now()}`;

  await signInToMyOrders(page, email, orderNumber);
  await rateButton(page, orderNumber).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(`Rate order ${orderNumber}`)).toBeVisible();
  await dialog.getByRole("radio", { name: "4 stars" }).click();
  await dialog.getByPlaceholder("Tell us about your order").fill(comment);
  await dialog.getByRole("button", { name: "Submit rating" }).click();

  await expect(page.getByRole("dialog")).toHaveCount(0);
  const row = orderRow(page, orderNumber);
  await expect(row.getByRole("img", { name: "Rated 4 out of 5 stars" })).toBeVisible();
  await expect(row.getByText(comment)).toBeVisible();
  await expect(rateButton(page, orderNumber)).toHaveCount(0);

  await page.reload();
  await expect(orderRow(page, orderNumber).getByRole("img", { name: "Rated 4 out of 5 stars" })).toBeVisible();
  await expect(rateButton(page, orderNumber)).toHaveCount(0);

  await page.goto(`/tracking/${orderNumber}`);
  await expect(page.getByRole("img", { name: "Rated 4 out of 5 stars" })).toBeVisible();
  await expect(page.getByText(comment)).toBeVisible();
});

test("stars can be chosen with the keyboard", async ({ page, request }) => {
  const { token, email } = await registerCustomerViaApi(request, API);
  const orderNumber = await createDeliveredOrder(request, token);

  await signInToMyOrders(page, email, orderNumber);
  await rateButton(page, orderNumber).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("radio", { name: "1 star" }).focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(dialog.getByRole("radio", { name: "3 stars" })).toBeChecked();
  await dialog.getByRole("button", { name: "Submit rating" }).click();

  await expect(orderRow(page, orderNumber).getByRole("img", { name: "Rated 3 out of 5 stars" })).toBeVisible();
});

test("submitting without stars asks for a rating and saves nothing", async ({ page, request }) => {
  const { token, email } = await registerCustomerViaApi(request, API);
  const orderNumber = await createDeliveredOrder(request, token);

  await signInToMyOrders(page, email, orderNumber);
  await rateButton(page, orderNumber).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Submit rating" }).click();

  await expect(dialog.getByText("Choose a rating from 1 to 5 stars")).toBeVisible();
  const order = await (await request.get(`${API}/api/order/number/${orderNumber}`)).json();
  expect(order.review).toBeNull();
});

test("a rating the server refuses shows the reason and keeps the dialog open", async ({ page, request }) => {
  const { token, email } = await registerCustomerViaApi(request, API);
  const orderNumber = await createDeliveredOrder(request, token);

  await signInToMyOrders(page, email, orderNumber);
  await rateButton(page, orderNumber).click();

  // The order gets rated elsewhere (another tab) while the dialog is open.
  const other = await request.post(`${API}/api/customer/orders/${orderNumber}/review`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { stars: 2 },
  });
  expect(other.ok()).toBeTruthy();

  const dialog = page.getByRole("dialog");
  await dialog.getByRole("radio", { name: "5 stars" }).click();
  await dialog.getByRole("button", { name: "Submit rating" }).click();

  await expect(dialog.getByRole("alert")).toContainText("Order already reviewed.");
  await expect(dialog.getByRole("button", { name: "Try again" })).toBeEnabled();
});

test("orders that are not delivered show no rating option", async ({ page, request }) => {
  const { token, email } = await registerCustomerViaApi(request, API);
  const newOrder = await createOrder(request, token);
  const acceptedOrder = await createOrder(request, token);
  await setStatusAsAdmin(request, acceptedOrder, ["ACCEPTED"]);

  await signInToMyOrders(page, email, acceptedOrder);
  await expect(orderRow(page, newOrder)).toBeVisible();

  await expect(rateButton(page, newOrder)).toHaveCount(0);
  await expect(rateButton(page, acceptedOrder)).toHaveCount(0);
});
