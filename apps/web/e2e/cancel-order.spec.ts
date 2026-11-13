import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { registerCustomerViaApi } from "./auth";

// KAN-5 / KAN-7: a customer can cancel their own order only while it is NEW.
// Every test creates its own customer and order through the API, so tests don't
// depend on each other or on execution order. No fixed waits: the dev backend
// adds random latency, so we wait for state (visible text, API responses).

const API = process.env.VITE_API_BASE_URL || "http://localhost:8081";
const PASSWORD = "secret123";

async function createNewOrder(request: APIRequestContext, token: string): Promise<string> {
  const chefs = await (await request.get(`${API}/api/chef/active?page=0&size=12`)).json();
  const chef = chefs.exploreChefResponseDtoList[0];
  const detail = await (await request.get(`${API}/api/chef/${chef.id}`)).json();
  const dish = detail.dishes[0];
  expect(dish, "seed must contain at least one active dish").toBeTruthy();

  const res = await request.post(`${API}/api/order`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      chefId: chef.id,
      receiverName: "Cancel E2E",
      receiverPhoneNumber: "+37490000000",
      receiverEmail: "cancel-e2e@example.com",
      paymentType: "CASH",
      deliveryMethod: "TAKEAWAY",
      note: "cancel e2e",
      createOrderDishes: [{ dishId: dish.id, quantity: Math.max(1, dish.minimumOrderCount ?? 1) }],
    },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.status).toBe("NEW");
  return body.number as string;
}

async function acceptAsAdmin(request: APIRequestContext, orderNumber: string) {
  const login = await request.post(`${API}/admin/auth/login`, {
    data: { username: "admin", password: "admin123" },
  });
  expect(login.ok()).toBeTruthy();
  const { token } = await login.json();
  const order = await (await request.get(`${API}/api/order/number/${orderNumber}`)).json();
  const res = await request.patch(`${API}/admin/order/${order.id}/status`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { status: "ACCEPTED" },
  });
  expect(res.ok()).toBeTruthy();
}

function waitForMyOrders(page: Page) {
  return page.waitForResponse(
    (res) => res.url().includes("/api/customer/orders?") && res.request().method() === "GET",
  );
}

/** Signs in through the UI and lands on the order's tracking page. */
async function signInAndOpenTracking(page: Page, email: string, orderNumber: string) {
  await page.goto(`/login?next=${encodeURIComponent(`/tracking/${orderNumber}`)}`);
  const form = page.getByRole("form", { name: "Sign in" });
  await form.getByLabel("Email").fill(email);
  await form.getByLabel("Password").fill(PASSWORD);
  const myOrders = waitForMyOrders(page);
  await form.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(new RegExp(`/tracking/${orderNumber}$`));
  await expect(page.getByRole("heading", { name: `Order ${orderNumber}` })).toBeVisible();
  // The cancel button depends on the customer's own order list: wait for it to load
  // so that "button is absent" assertions can't pass too early.
  await myOrders;
}

const cancelButton = (page: Page) => page.getByRole("button", { name: "Cancel order" });

test("customer cancels a new order from the tracking page", async ({ page, request }) => {
  const { token, email } = await registerCustomerViaApi(request, API);
  const orderNumber = await createNewOrder(request, token);

  await signInAndOpenTracking(page, email, orderNumber);
  await expect(page.getByText("Order received")).toBeVisible();

  await cancelButton(page).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(`Cancel order ${orderNumber}?`)).toBeVisible();
  await dialog.getByRole("button", { name: "Yes, cancel order" }).click();

  await expect(page.getByText("Order cancelled")).toBeVisible();
  await expect(cancelButton(page)).toHaveCount(0);

  await page.getByRole("link", { name: "All orders" }).click();
  await expect(page).toHaveURL(/\/orders$/);
  const row = page.getByRole("listitem").filter({ hasText: orderNumber });
  await expect(row.getByText("Cancelled", { exact: true })).toBeVisible();
});

test("keeping the order in the confirmation dialog leaves it received", async ({ page, request }) => {
  const { token, email } = await registerCustomerViaApi(request, API);
  const orderNumber = await createNewOrder(request, token);

  await signInAndOpenTracking(page, email, orderNumber);
  await cancelButton(page).click();
  await page.getByRole("dialog").getByRole("button", { name: "Keep order" }).click();

  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("Order received")).toBeVisible();
  await expect(cancelButton(page)).toBeVisible();
  const order = await (await request.get(`${API}/api/order/number/${orderNumber}`)).json();
  expect(order.status).toBe("NEW");
});

test("cancel button is hidden once the kitchen accepts the order", async ({ page, request }) => {
  const { token, email } = await registerCustomerViaApi(request, API);
  const orderNumber = await createNewOrder(request, token);
  await acceptAsAdmin(request, orderNumber);

  await signInAndOpenTracking(page, email, orderNumber);

  await expect(page.getByText("Preparing your order")).toBeVisible();
  await expect(cancelButton(page)).toHaveCount(0);
});

test("cancelling after the kitchen accepted shows an error and hides the button", async ({
  page,
  request,
}) => {
  const { token, email } = await registerCustomerViaApi(request, API);
  const orderNumber = await createNewOrder(request, token);

  await signInAndOpenTracking(page, email, orderNumber);
  await expect(cancelButton(page)).toBeVisible();

  // The kitchen accepts while the customer still sees the old NEW page.
  await acceptAsAdmin(request, orderNumber);
  await cancelButton(page).click();
  await page.getByRole("dialog").getByRole("button", { name: "Yes, cancel order" }).click();

  await expect(page.getByRole("alert").filter({ hasText: "Couldn’t cancel this order" })).toBeVisible();
  await expect(page.getByText("Preparing your order")).toBeVisible();
  await expect(cancelButton(page)).toHaveCount(0);
  const order = await (await request.get(`${API}/api/order/number/${orderNumber}`)).json();
  expect(order.status).toBe("ACCEPTED");
});

test("cancel button is not shown on someone else's order", async ({ page, request }) => {
  const owner = await registerCustomerViaApi(request, API);
  const orderNumber = await createNewOrder(request, owner.token);
  const stranger = await registerCustomerViaApi(request, API);

  await signInAndOpenTracking(page, stranger.email, orderNumber);

  await expect(page.getByText("Order received")).toBeVisible();
  await expect(cancelButton(page)).toHaveCount(0);
});

test("anonymous visitor sees no cancel button on tracking", async ({ page, request }) => {
  const { token } = await registerCustomerViaApi(request, API);
  const orderNumber = await createNewOrder(request, token);

  await page.goto(`/tracking/${orderNumber}`);

  await expect(page.getByText("Order received")).toBeVisible();
  await expect(page.getByRole("link", { name: "All orders" })).toHaveCount(0);
  await expect(cancelButton(page)).toHaveCount(0);
});
