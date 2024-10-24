import { test } from '../baseFixtures.js';
import { baseUrl } from '../defaults.js';
import { doQuickLogin } from '../login.js';

test('Stock', async ({ page }) => {
  await doQuickLogin(page);

  await page.goto(`${baseUrl}/stock/location/index/`);
  await page.waitForURL('**/platform/stock/location/**');

  await page.getByRole('tab', { name: 'Location Details' }).click();
  await page.waitForURL('**/platform/stock/location/index/details');

  await page.getByRole('tab', { name: 'Stock Items' }).click();
  await page.getByText('1551ABK').first().click();

  await page.getByRole('tab', { name: 'Stock', exact: true }).click();
  await page.waitForURL('**/platform/stock/**');
  await page.getByRole('tab', { name: 'Stock Locations' }).click();
  await page.getByRole('cell', { name: 'Electronics Lab' }).first().click();
  await page.getByRole('tab', { name: 'Default Parts' }).click();
  await page.getByRole('tab', { name: 'Stock Locations' }).click();
  await page.getByRole('tab', { name: 'Stock Items' }).click();
  await page.getByRole('tab', { name: 'Location Details' }).click();

  await page.goto(`${baseUrl}/stock/item/1194/details`);
  await page.getByText('D.123 | Doohickey').waitFor();
  await page.getByText('Batch Code: BX-123-2024-2-7').waitFor();
  await page.getByRole('tab', { name: 'Stock Tracking' }).click();
  await page.getByRole('tab', { name: 'Test Data' }).click();
  await page.getByText('395c6d5586e5fb656901d047be27e1f7').waitFor();
  await page.getByRole('tab', { name: 'Installed Items' }).click();
});

test('Stock - Location Tree', async ({ page }) => {
  await doQuickLogin(page);

  await page.goto(`${baseUrl}/stock/location/index/`);
  await page.waitForURL('**/platform/stock/location/**');
  await page.getByRole('tab', { name: 'Location Details' }).click();

  await page.getByLabel('nav-breadcrumb-action').click();
  await page.getByLabel('nav-tree-toggle-1}').click();
  await page.getByLabel('nav-tree-item-2').click();

  await page.getByLabel('breadcrumb-2-storage-room-a').waitFor();
  await page.getByLabel('breadcrumb-1-factory').click();

  await page.getByRole('cell', { name: 'Factory' }).first().waitFor();
});

test('Stock - Serial Numbers', async ({ page }) => {
  await doQuickLogin(page);

  // Use the "global search" functionality to find a part we are interested in
  // This is to exercise the search functionality and ensure it is working as expected
  await page.getByLabel('open-search').click();

  await page.getByLabel('global-search-input').clear();

  await page.waitForTimeout(250);
  await page.getByLabel('global-search-input').fill('widget green');
  await page.waitForTimeout(250);

  // Remove the "stock item" results group
  await page.getByLabel('remove-search-group-stockitem').click();

  await page
    .getByText(/widget\.green/)
    .first()
    .click();

  await page
    .getByLabel('panel-tabs-part')
    .getByRole('tab', { name: 'Stock', exact: true })
    .click();
  await page.getByLabel('action-button-add-stock-item').click();

  // Initially fill with invalid serial/quantity combinations
  await page.getByLabel('text-field-serial_numbers').fill('200-250');
  await page.getByLabel('number-field-quantity').fill('10');

  // Add delay to account to field debounce
  await page.waitForTimeout(250);

  await page.getByRole('button', { name: 'Submit' }).click();

  // Expected error messages
  await page.getByText('Errors exist for one or more form fields').waitFor();
  await page
    .getByText(/exceeds allowed quantity/)
    .first()
    .waitFor();

  // Now, with correct quantity
  await page.getByLabel('number-field-quantity').fill('51');
  await page.waitForTimeout(250);
  await page.getByRole('button', { name: 'Submit' }).click();
  await page.waitForTimeout(250);

  await page
    .getByText(
      /The following serial numbers already exist or are invalid : 200,201,202,203,204/
    )
    .first()
    .waitFor();

  // Expected error messages
  await page.getByText('Errors exist for one or more form fields').waitFor();

  // Close the form
  await page.getByRole('button', { name: 'Cancel' }).click();
});

/**
 * Test various 'actions' on the stock detail page
 */
test('Stock - Stock Actions', async ({ page }) => {
  await doQuickLogin(page);

  // Find an in-stock, untracked item
  await page.goto(
    `${baseUrl}/stock/location/index/stock-items?in_stock=1&serialized=0`
  );
  await page.getByText('530470210').first().click();
  await page
    .locator('div')
    .filter({ hasText: /^Quantity: 270$/ })
    .first()
    .waitFor();

  // Check for expected action sections
  await page.getByLabel('action-menu-barcode-actions').click();
  await page.getByLabel('action-menu-barcode-actions-link-barcode').click();
  await page.getByRole('banner').getByRole('button').click();

  await page.getByLabel('action-menu-printing-actions').click();
  await page.getByLabel('action-menu-printing-actions-print-labels').click();
  await page.getByRole('button', { name: 'Cancel' }).click();

  await page.getByLabel('action-menu-stock-operations').click();
  await page.getByLabel('action-menu-stock-operations-count').waitFor();
  await page.getByLabel('action-menu-stock-operations-add').waitFor();
  await page.getByLabel('action-menu-stock-operations-remove').waitFor();
  await page.getByLabel('action-menu-stock-operations-transfer').click();
  await page.getByLabel('text-field-notes').fill('test notes');
  await page.getByRole('button', { name: 'Submit' }).click();
  await page.getByText('This field is required.').first().waitFor();
  await page.getByRole('button', { name: 'Cancel' }).click();

  // Find an item which has been sent to a customer
  await page.goto(`${baseUrl}/stock/item/1012/details`);
  await page.getByText('Batch Code: 2022-11-12').waitFor();
  await page.getByText('Unavailable').waitFor();
  await page.getByLabel('action-menu-stock-operations').click();
  await page.getByLabel('action-menu-stock-operations-return').click();

  await page.waitForTimeout(2500);
});
