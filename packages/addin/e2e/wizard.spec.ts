import { expect, test } from '@playwright/test';

test('load sample data, review, submit to mock gateway, see history', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Not running inside Excel')).toBeVisible();

  await page.getByRole('button', { name: 'Load from sheet' }).click();
  await expect(page.getByText('Example Trading Ltd')).toBeVisible();
  await expect(page.getByText('Balance sheet balances.')).toBeVisible();
  await expect(page.getByText('Corporation tax')).toBeVisible();

  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Submit CT600' }).click();
  await expect(page.getByText(/CT600: accepted/)).toBeVisible();
  await page.getByRole('button', { name: 'Submit accounts' }).click();
  await expect(page.getByText(/Accounts: accepted/)).toBeVisible();

  await page.getByRole('button', { name: 'History' }).click();
  await expect(page.getByRole('table', { name: 'Submission history' }).getByText('CT600').first()).toBeVisible();
});

test('live mode is disabled by default', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Load from sheet' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('combobox', { name: 'Mode' }).click();
  await expect(page.getByRole('option', { name: /live/ })).toBeDisabled();
});
