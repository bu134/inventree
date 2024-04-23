import { expect } from './baseFixtures.js';
import { baseUrl, loginUrl, logoutUrl, user } from './defaults';

/*
 * Perform form based login operation from the "login" URL
 */
export const doLogin = async (page, username?: string, password?: string) => {
  username = username ?? user.username;
  password = password ?? user.password;

  await page.goto(logoutUrl);
  await page.goto(loginUrl);
  await expect(page).toHaveTitle(RegExp('^InvenTree.*$'));
  await page.waitForURL('**/platform/login');
  await page.getByLabel('username').fill(username);
  await page.getByLabel('password').fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL('**/platform/home');
  await page.waitForTimeout(250);
};

/*
 * Perform a quick login based on passing URL parameters
 */
export const doQuickLogin = async (
  page,
  username?: string,
  password?: string,
  url?: string
) => {
  username = username ?? user.username;
  password = password ?? user.password;
  url = url ?? baseUrl;

  // await page.goto(logoutUrl);
  await page.goto(`${url}/login/?login=${username}&password=${password}`);
  await page.waitForURL('**/platform/home');
  await page.waitForTimeout(250);
};
