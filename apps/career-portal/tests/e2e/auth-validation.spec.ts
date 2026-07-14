import { expect, test } from "@playwright/test";

import { expectResponsiveDocument } from "./helpers";

test("login rejects malformed credentials before sending an auth request", async ({
  page,
}) => {
  let authRequests = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/auth/sign-in")) authRequests += 1;
  });

  await page.goto("/login");
  await page.getByLabel("Email address").fill("not-an-email");
  await page.getByLabel("Password").fill("secret1");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(
    page.getByText("Enter a valid email address", { exact: true }),
  ).toBeVisible();
  expect(authRequests).toBe(0);
  await expectResponsiveDocument(page);
});

test("registration reports mismatched passwords without creating an account", async ({
  page,
}) => {
  let signUpRequests = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/auth/sign-up")) signUpRequests += 1;
  });

  await page.goto("/register");
  await page.getByLabel("Full name").fill("Vivek Kumar");
  await page.getByLabel("Email address").fill("vivek@example.com");
  await page.getByLabel("Phone number").fill("9876543210");
  await page.getByLabel("Password", { exact: true }).fill("secret1");
  await page.getByLabel("Confirm password").fill("secret2");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(
    page.getByText("Passwords do not match", { exact: true }),
  ).toBeVisible();
  expect(signUpRequests).toBe(0);
  await expectResponsiveDocument(page);
});
