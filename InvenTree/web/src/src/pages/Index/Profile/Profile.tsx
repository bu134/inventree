import {
  Tabs,
} from '@mantine/core';
import { useNavigate, useParams } from 'react-router-dom';
import { StylishText } from '../../../components/items/StylishText';
import { Trans, t } from '@lingui/macro'
import { UserPanel } from './UserPanel';
import { SettingsPanel } from './SettingsPanel';


export function Profile() {
  const navigate = useNavigate();
  const { tabValue } = useParams();

  return (
    <>
      <StylishText><Trans>Profile</Trans></StylishText>
      <Tabs
        value={tabValue}
        onTabChange={(value) => navigate(`/profile/${value}`)}
      >
        <Tabs.List>
          <Tabs.Tab value="user"><Trans>User</Trans></Tabs.Tab>
          <Tabs.Tab value="user-settings"><Trans>User Settings</Trans></Tabs.Tab>
          <Tabs.Tab value="notification-settings"><Trans>Notification Settings</Trans></Tabs.Tab>
          <Tabs.Tab value="global-settings"><Trans>Global Settings</Trans></Tabs.Tab>
          <Tabs.Tab value="plugin-settings"><Trans>Plugin Settings</Trans></Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="user">
          <UserPanel />
        </Tabs.Panel>
        <Tabs.Panel value="user-settings">
          <SettingsPanel reference='user' title={t`User Settings`} description={t`Settings for the current user`} />
        </Tabs.Panel>
        <Tabs.Panel value="notification-settings">
          <SettingsPanel reference='notification' title={t`Notification Settings`} description={t`Settings for the notifications`} />
        </Tabs.Panel>
        <Tabs.Panel value="global-settings">
          <SettingsPanel reference='global'
            title={t`Global Server Settings`}
            description={t`Global Settings for this instance`}
            sections={[
              {
                key: 'server', name: 'Server Settings', keys: [
                  { key: 'INVENTREE_COMPANY_NAME', icon: 'fa-building' },
                  { key: 'INVENTREE_BASE_URL', icon: 'fa-globe' },
                  { key: 'INVENTREE_INSTANCE', icon: 'fa-info-circle' },
                  { key: 'INVENTREE_INSTANCE_TITLE', icon: 'fa-info-circle' },
                  { key: 'INVENTREE_RESTRICT_ABOUT', icon: 'fa-info-circle' },
                  { key: 'INVENTREE_DOWNLOAD_FROM_URL', icon: 'fa-cloud-download-alt' },
                  { key: 'INVENTREE_DOWNLOAD_IMAGE_MAX_SIZE', icon: 'fa-server' },
                  { key: 'INVENTREE_REQUIRE_CONFIRM', icon: 'fa-check' },
                  { key: 'INVENTREE_TREE_DEPTH', icon: 'fa-sitemap' },
                  { key: 'INVENTREE_BACKUP_ENABLE', icon: 'fa-hdd' },
                  { key: 'INVENTREE_DELETE_TASKS_DAYS', icon: 'fa-calendar-alt' },
                  { key: 'INVENTREE_DELETE_ERRORS_DAYS', icon: 'fa-calendar-alt' },
                  { key: 'INVENTREE_DELETE_NOTIFICATIONS_DAYS', icon: 'fa-calendar-alt' },
                ]
              },
              {
                key: 'login', name: 'Login Settings', keys: [
                  { key: 'LOGIN_ENABLE_SSO', icon: 'fa-user-shield' },
                  { key: 'LOGIN_ENABLE_PWD_FORGOT', icon: 'fa-user-lock' },
                  { key: 'LOGIN_MAIL_REQUIRED', icon: 'fa-at' },
                  { key: 'LOGIN_ENFORCE_MFA', icon: 'fa-key' },
                  { key: 'LOGIN_ENABLE_REG', icon: 'fa-user-plus' },
                  { key: 'LOGIN_SIGNUP_MAIL_TWICE', icon: 'fa-at' },
                  { key: 'LOGIN_SIGNUP_PWD_TWICE', icon: 'fa-user-lock' },
                  { key: 'LOGIN_SIGNUP_SSO_AUTO', icon: 'fa-key' },
                  { key: 'SIGNUP_GROUP', icon: 'fa-users' }]
              },
              {
                key: 'barcodes', name: 'Barcode Settings', keys: [
                  { key: 'BARCODE_ENABLE', icon: 'fa-qrcode' },
                  { key: 'BARCODE_INPUT_DELAY', icon: 'fa-hourglass-half' },
                  { key: 'BARCODE_WEBCAM_SUPPORT', icon: 'fa-video' },
                ]
              },
              {
                key: 'labels', name: 'Label Settings', keys: [
                  { key: 'LABEL_ENABLE', icon: 'fa-toggle-on' },
                  { key: 'LABEL_DPI', icon: 'fa-toggle-on' },
                ]
              },
              {
                key: 'reporting', name: 'Report Settings', keys: [
                  { key: 'REPORT_ENABLE', icon: 'fa-file-pdf' },
                  { key: 'REPORT_DEFAULT_PAGE_SIZE', icon: 'fa-print' },
                  { key: 'REPORT_DEBUG_MODE', icon: 'fa-laptop-code' },
                  { key: 'REPORT_ENABLE_TEST_REPORT', icon: 'fa-vial' },
                  { key: 'REPORT_ATTACH_TEST_REPORT', icon: 'fa-file-upload' },
                ]
              },
              {
                key: 'parts', name: 'Part Settings', keys: [
                  { key: 'PART_IPN_REGEX' },
                  { key: 'PART_ALLOW_DUPLICATE_IPN' },
                  { key: 'PART_ALLOW_EDIT_IPN' },
                  { key: 'PART_NAME_FORMAT' },
                  { key: 'PART_SHOW_RELATED', icon: 'fa-random' },
                  { key: 'PART_CREATE_INITIAL', icon: 'fa-boxes' },
                  { key: 'PART_TEMPLATE', icon: 'fa-clone' },
                  { key: 'PART_ASSEMBLY', icon: 'fa-tools' },
                  { key: 'PART_COMPONENT', icon: 'fa-th' },
                  { key: 'PART_TRACKABLE', icon: 'fa-directions' },
                  { key: 'PART_PURCHASEABLE', icon: 'fa-shopping-cart' },
                  { key: 'PART_SALABLE', icon: 'fa-dollar-sign' },
                  { key: 'PART_VIRTUAL', icon: 'fa-ghost' },
                  { key: 'PART_COPY_BOM' },
                  { key: 'PART_COPY_PARAMETERS' },
                  { key: 'PART_COPY_TESTS' },
                  { key: 'PART_CATEGORY_PARAMETERS' },
                  { key: 'PART_CATEGORY_DEFAULT_ICON', icon: 'fa-icons' },
                  { key: 'PART_SHOW_IMPORT', icon: 'fa-file-upload' },
                ]
              },
              {
                key: 'pricing', name: 'Pricing Settings', keys: [
                  { key: 'PART_INTERNAL_PRICE' },
                  { key: 'PART_BOM_USE_INTERNAL_PRICE' },
                  { key: 'PRICING_DECIMAL_PLACES' },
                  { key: 'PRICING_UPDATE_DAYS', icon: 'fa-calendar-alt' },
                  { key: 'PRICING_USE_SUPPLIER_PRICING', icon: 'fa-check-circle' },
                  { key: 'INVENTREE_DEFAULT_CURRENCY', icon: 'fa-globe' },
                ]
              },
              {
                key: 'stock', name: 'Stock Settings', keys: [
                  { key: 'SERIAL_NUMBER_GLOBALLY_UNIQUE', icon: 'fa-hashtag' },
                  { key: 'STOCK_BATCH_CODE_TEMPLATE', icon: 'fa-layer-group' },
                  { key: 'STOCK_ENABLE_EXPIRY', icon: 'fa-stopwatch' },
                  { key: 'STOCK_STALE_DAYS', icon: 'fa-calendar' },
                  { key: 'STOCK_ALLOW_EXPIRED_SALE', icon: 'fa-truck' },
                  { key: 'STOCK_ALLOW_EXPIRED_BUILD', icon: 'fa-tools' },
                  { key: 'STOCK_OWNERSHIP_CONTROL', icon: 'fa-users' },
                  { key: 'STOCK_LOCATION_DEFAULT_ICON', icon: 'fa-icons' },
                ]
              },
              {
                key: 'build-order', name: 'Build Order Settings', keys: [
                  { key: 'BUILDORDER_REFERENCE_PATTERN' },
                ]
              },
              {
                key: 'purchase-order', name: 'Purchase Order Settings', keys: [
                  { key: 'PURCHASEORDER_REFERENCE_PATTERN' },
                  { key: 'PURCHASEORDER_EDIT_COMPLETED_ORDERS', icon: 'fa-edit' },
                ]
              },
              {
                key: 'sales-order', name: 'Sales Order Settings', keys: [
                  { key: 'SALESORDER_REFERENCE_PATTERN' },
                  { key: 'SALESORDER_DEFAULT_SHIPMENT', icon: 'fa-truck-loading' },
                  { key: 'SALESORDER_EDIT_COMPLETED_ORDERS', icon: 'fa-edit' },
                ]
              },
              {
                key: 'plugin', name: 'Plugin Settings', keys: [
                  { key: 'ENABLE_PLUGINS_SCHEDULE', icon: 'fa-calendar-alt' },
                  { key: 'ENABLE_PLUGINS_EVENTS', icon: 'fa-reply-all' },
                  { key: 'ENABLE_PLUGINS_URL', icon: 'fa-link' },
                  { key: 'ENABLE_PLUGINS_NAVIGATION', icon: 'fa-sitemap' },
                  { key: 'ENABLE_PLUGINS_APP', icon: 'fa-rocket' },
                  { key: 'PLUGIN_ON_STARTUP' },
                  { key: 'PLUGIN_CHECK_SIGNATURES' },
                ]
              },
            ]}
          />
        </Tabs.Panel>
        <Tabs.Panel value="plugin-settings">
          <SettingsPanel reference='plugin' title={t`Plugin Settings`} description={t`Plugin Settings for this instance`} url='plugin/settings/' />
        </Tabs.Panel>
      </Tabs>
    </>
  );
}
