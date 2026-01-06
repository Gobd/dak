import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should show login screen by default', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Welcome Back')).toBeVisible();
    await expect(page.getByText('Sign in to your account')).toBeVisible();
  });

  test('should have link to register page', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Create Account').click();
    await expect(page.getByText('Enter your email to get started')).toBeVisible();
  });

  test('should have link to forgot password', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Forgot password?').click();
    await expect(page.getByText('Enter your email to receive a reset link')).toBeVisible();
  });

  test('should show validation error for empty email', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Sign In' }).click();
    await expect(page.getByText('Please enter your email')).toBeVisible();
  });
});
