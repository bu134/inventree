"""Unit testing for the various report models."""

import os
import shutil
from io import StringIO

from django.apps import apps
from django.conf import settings
from django.core.cache import cache
from django.http.response import StreamingHttpResponse
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from django.utils.safestring import SafeString

import pytz
from PIL import Image

import report.models as report_models
from build.models import Build
from common.models import InvenTreeSetting, InvenTreeUserSetting
from InvenTree.files import MEDIA_STORAGE_DIR, TEMPLATES_DIR
from InvenTree.unit_test import InvenTreeAPITestCase
from report.templatetags import barcode as barcode_tags
from report.templatetags import report as report_tags
from stock.models import StockItem, StockItemAttachment


class ReportTagTest(TestCase):
    """Unit tests for the report template tags."""

    def debug_mode(self, value: bool):
        """Enable or disable debug mode for reports."""
        InvenTreeSetting.set_setting('REPORT_DEBUG_MODE', value, change_user=None)

    def test_getindex(self):
        """Tests for the 'getindex' template tag."""
        fn = report_tags.getindex
        data = [1, 2, 3, 4, 5, 6]

        # Out of bounds or invalid
        self.assertEqual(fn(data, -1), None)
        self.assertEqual(fn(data, 99), None)
        self.assertEqual(fn(data, 'xx'), None)

        for idx in range(len(data)):
            self.assertEqual(fn(data, idx), data[idx])

    def test_getkey(self):
        """Tests for the 'getkey' template tag."""
        data = {'hello': 'world', 'foo': 'bar', 'with spaces': 'withoutspaces', 1: 2}

        for k, v in data.items():
            self.assertEqual(report_tags.getkey(data, k), v)

    def test_asset(self):
        """Tests for asset files."""
        # Test that an error is raised if the file does not exist
        for b in [True, False]:
            self.debug_mode(b)

            with self.assertRaises(FileNotFoundError):
                report_tags.asset('bad_file.txt')

        # Create an asset file
        asset_dir = settings.MEDIA_ROOT.joinpath('report', 'assets')
        asset_dir.mkdir(parents=True, exist_ok=True)
        asset_path = asset_dir.joinpath('test.txt')

        asset_path.write_text('dummy data')

        self.debug_mode(True)
        asset = report_tags.asset('test.txt')
        self.assertEqual(asset, '/media/report/assets/test.txt')

        # Ensure that a 'safe string' also works
        asset = report_tags.asset(SafeString('test.txt'))
        self.assertEqual(asset, '/media/report/assets/test.txt')

        self.debug_mode(False)
        asset = report_tags.asset('test.txt')
        self.assertEqual(asset, f'file://{asset_dir}/test.txt')

    def test_uploaded_image(self):
        """Tests for retrieving uploaded images."""
        # Test for a missing image
        for b in [True, False]:
            self.debug_mode(b)

            with self.assertRaises(FileNotFoundError):
                report_tags.uploaded_image(
                    '/part/something/test.png', replace_missing=False
                )

            img = str(report_tags.uploaded_image('/part/something/other.png'))

            if b:
                self.assertIn('blank_image.png', img)
            else:
                self.assertIn('data:image/png;charset=utf-8;base64,', img)

        # Create a dummy image
        img_path = 'part/images/'
        img_path = settings.MEDIA_ROOT.joinpath(img_path)
        img_file = img_path.joinpath('test.jpg')

        img_path.mkdir(parents=True, exist_ok=True)
        img_file.write_text('dummy data')

        # Test in debug mode. Returns blank image as dummy file is not a valid image
        self.debug_mode(True)
        img = report_tags.uploaded_image('part/images/test.jpg')
        self.assertEqual(img, '/static/img/blank_image.png')

        # Now, let's create a proper image
        img = Image.new('RGB', (128, 128), color='RED')
        img.save(img_file)

        # Try again
        img = report_tags.uploaded_image('part/images/test.jpg')
        self.assertEqual(img, '/media/part/images/test.jpg')

        # Ensure that a 'safe string' also works
        img = report_tags.uploaded_image(SafeString('part/images/test.jpg'))
        self.assertEqual(img, '/media/part/images/test.jpg')

        self.debug_mode(False)
        img = report_tags.uploaded_image('part/images/test.jpg')
        self.assertTrue(img.startswith('data:image/png;charset=utf-8;base64,'))

        img = report_tags.uploaded_image(SafeString('part/images/test.jpg'))
        self.assertTrue(img.startswith('data:image/png;charset=utf-8;base64,'))

    def test_part_image(self):
        """Unit tests for the 'part_image' tag."""
        with self.assertRaises(TypeError):
            report_tags.part_image(None)

    def test_company_image(self):
        """Unit tests for the 'company_image' tag."""
        with self.assertRaises(TypeError):
            report_tags.company_image(None)

    def test_logo_image(self):
        """Unit tests for the 'logo_image' tag."""
        # By default, should return the core InvenTree logo
        for b in [True, False]:
            self.debug_mode(b)
            logo = report_tags.logo_image()
            self.assertIn('inventree.png', logo)

    def test_maths_tags(self):
        """Simple tests for mathematical operator tags."""
        self.assertEqual(report_tags.add(1, 2), 3)
        self.assertEqual(report_tags.subtract(10, 4.2), 5.8)
        self.assertEqual(report_tags.multiply(2.3, 4), 9.2)
        self.assertEqual(report_tags.divide(100, 5), 20)

    @override_settings(TIME_ZONE='America/New_York')
    def test_date_tags(self):
        """Test for date formatting tags.

        - Source timezone is Australia/Sydney
        - Server timezone is America/New York
        """
        time = timezone.datetime(
            year=2024,
            month=3,
            day=13,
            hour=12,
            minute=30,
            second=0,
            tzinfo=pytz.timezone('Australia/Sydney'),
        )

        # Format a set of tests: timezone, format, expected
        tests = [
            (None, None, '2024-03-12T22:25:00-04:00'),
            (None, '%d-%m-%y', '12-03-24'),
            ('UTC', None, '2024-03-13T02:25:00+00:00'),
            ('UTC', '%d-%B-%Y', '13-March-2024'),
            ('Europe/Amsterdam', None, '2024-03-13T03:25:00+01:00'),
            ('Europe/Amsterdam', '%y-%m-%d %H:%M', '24-03-13 03:25'),
        ]

        for tz, fmt, expected in tests:
            result = report_tags.format_datetime(time, tz, fmt)
            self.assertEqual(result, expected)


class BarcodeTagTest(TestCase):
    """Unit tests for the barcode template tags."""

    def test_barcode(self):
        """Test the barcode generation tag."""
        barcode = barcode_tags.barcode('12345')

        self.assertIsInstance(barcode, str)
        self.assertTrue(barcode.startswith('data:image/png;'))

        # Try with a different format
        barcode = barcode_tags.barcode('99999', format='BMP')
        self.assertIsInstance(barcode, str)
        self.assertTrue(barcode.startswith('data:image/bmp;'))

    def test_qrcode(self):
        """Test the qrcode generation tag."""
        # Test with default settings
        qrcode = barcode_tags.qrcode('hello world')
        self.assertIsInstance(qrcode, str)
        self.assertTrue(qrcode.startswith('data:image/png;'))
        self.assertEqual(len(qrcode), 700)

        # Generate a much larger qrcode
        qrcode = barcode_tags.qrcode(
            'hello_world', version=2, box_size=50, format='BMP'
        )
        self.assertIsInstance(qrcode, str)
        self.assertTrue(qrcode.startswith('data:image/bmp;'))
        self.assertEqual(len(qrcode), 309720)


class ReportTest(InvenTreeAPITestCase):
    """Base class for unit testing reporting models."""

    fixtures = [
        'category',
        'part',
        'company',
        'location',
        'test_templates',
        'supplier_part',
        'stock',
        'stock_tests',
        'bom',
        'build',
    ]

    superuser = True

    model = None
    list_url = None
    detail_url = None
    print_url = None

    def setUp(self):
        """Ensure cache is cleared as part of test setup."""
        cache.clear()
        return super().setUp()

    def test_api_url(self):
        """Test returned API Url against URL tag defined in this file."""
        if not self.list_url:
            return

        self.assertEqual(reverse(self.list_url), self.model.get_api_url())

    def test_list_endpoint(self):
        """Test that the LIST endpoint works for each report."""
        if not self.list_url:
            return

        url = reverse(self.list_url)

        response = self.get(url)
        self.assertEqual(response.status_code, 200)

        reports = self.model.objects.all()

        n = len(reports)
        # API endpoint must return correct number of reports
        self.assertEqual(len(response.data), n)

        # Filter by "enabled" status
        response = self.get(url, {'enabled': True})
        self.assertEqual(len(response.data), n)

        response = self.get(url, {'enabled': False})
        self.assertEqual(len(response.data), 0)

        # Disable each report
        for report in reports:
            report.enabled = False
            report.save()

        # Filter by "enabled" status
        response = self.get(url, {'enabled': True})
        self.assertEqual(len(response.data), 0)

        response = self.get(url, {'enabled': False})
        self.assertEqual(len(response.data), n)

    def test_create_endpoint(self):
        """Test that creating a new report works for each report."""
        if not self.list_url:
            return

        url = reverse(self.list_url)

        # Create a new report
        # Django REST API "APITestCase" does not work like requests - to send a file without it existing on disk,
        # create it as a StringIO object, and upload it under parameter template
        filestr = StringIO(
            '{% extends "label/report_base.html" %}{% block content %}<pre>TEST REPORT</pre>{% endblock content %}'
        )
        filestr.name = 'ExampleTemplate.html'

        response = self.post(
            url,
            data={
                'name': 'New report',
                'description': 'A fancy new report created through API test',
                'template': filestr,
                'model_type': 'part',
            },
            format=None,
            expected_code=201,
        )

        # Make sure the expected keys are in the response
        self.assertIn('pk', response.data)
        self.assertIn('name', response.data)
        self.assertIn('description', response.data)
        self.assertIn('template', response.data)
        self.assertIn('filters', response.data)
        self.assertIn('enabled', response.data)

        self.assertEqual(response.data['name'], 'New report')
        self.assertEqual(
            response.data['description'], 'A fancy new report created through API test'
        )
        self.assertTrue(response.data['template'].endswith('ExampleTemplate.html'))

    def test_detail_endpoint(self):
        """Test that the DETAIL endpoint works for each report."""
        if not self.detail_url:
            return

        reports = self.model.objects.all()

        n = len(reports)

        # Make sure at least one report defined
        self.assertGreaterEqual(n, 1)

        # Check detail page for first report
        response = self.get(
            reverse(self.detail_url, kwargs={'pk': reports[0].pk}), expected_code=200
        )

        # Make sure the expected keys are in the response
        self.assertIn('pk', response.data)
        self.assertIn('name', response.data)
        self.assertIn('description', response.data)
        self.assertIn('template', response.data)
        self.assertIn('filters', response.data)
        self.assertIn('enabled', response.data)

        filestr = StringIO(
            '{% extends "label/report_base.html" %}{% block content %}<pre>TEST REPORT VERSION 2</pre>{% endblock content %}'
        )
        filestr.name = 'ExampleTemplate_Updated.html'

        # Check PATCH method
        response = self.patch(
            reverse(self.detail_url, kwargs={'pk': reports[0].pk}),
            {
                'name': 'Changed name during test',
                'description': 'New version of the template',
                'template': filestr,
            },
            format=None,
            expected_code=200,
        )

        # Make sure the expected keys are in the response
        self.assertIn('pk', response.data)
        self.assertIn('name', response.data)
        self.assertIn('description', response.data)
        self.assertIn('template', response.data)
        self.assertIn('filters', response.data)
        self.assertIn('enabled', response.data)

        self.assertEqual(response.data['name'], 'Changed name during test')
        self.assertEqual(response.data['description'], 'New version of the template')

        self.assertTrue(
            response.data['template'].endswith('ExampleTemplate_Updated.html')
        )

        # Delete the last report
        response = self.delete(
            reverse(self.detail_url, kwargs={'pk': reports[n - 1].pk}),
            expected_code=204,
        )

    def test_metadata(self):
        """Unit tests for the metadata field."""
        if self.model is not None:
            p = self.model.objects.first()

            self.assertEqual(p.metadata, {})

            self.assertIsNone(p.get_metadata('test'))
            self.assertEqual(p.get_metadata('test', backup_value=123), 123)

            # Test update via the set_metadata() method
            p.set_metadata('test', 3)
            self.assertEqual(p.get_metadata('test'), 3)

            for k in ['apple', 'banana', 'carrot', 'carrot', 'banana']:
                p.set_metadata(k, k)

            self.assertEqual(len(p.metadata.keys()), 4)


class TestReportTest(ReportTest):
    """Unit testing class for the stock item TestReport model."""

    model = report_models.ReportTemplate

    list_url = 'api-report-template-list'
    detail_url = 'api-report-template-detail'
    print_url = 'api-report-print'

    def setUp(self):
        """Setup function for the stock item TestReport."""
        apps.get_app_config('report').create_default_reports()

        return super().setUp()

    def test_print(self):
        """Printing tests for the TestReport."""
        report = self.model.objects.first()

        url = reverse(self.print_url)

        # Try to print without providing a valid StockItem
        self.post(url, {'template': report.pk}, expected_code=400)

        # Try to print with an invalid StockItem
        self.post(url, {'template': report.pk, 'items': [9999]}, expected_code=400)

        # Now print with a valid StockItem
        item = StockItem.objects.first()

        response = self.post(
            url, {'template': report.pk, 'items': [item.pk]}, expected_code=201
        )

        # There should be a link to the generated PDF
        self.assertEqual(response.data['output'].startswith('/media/report/'), True)

        # By default, this should *not* have created an attachment against this stockitem
        self.assertFalse(StockItemAttachment.objects.filter(stock_item=item).exists())

        return
        # TODO @matmair - Re-add this test after https://github.com/inventree/InvenTree/pull/7074/files#r1600694356 is resolved
        # Change the setting, now the test report should be attached automatically
        InvenTreeSetting.set_setting('REPORT_ATTACH_TEST_REPORT', True, None)

        response = self.post(
            url, {'template': report.pk, 'items': [item.pk]}, expected_code=201
        )

        # There should be a link to the generated PDF
        self.assertEqual(response.data['output'].startswith('/media/report/'), True)

        # Check that a report has been uploaded
        attachment = StockItemAttachment.objects.filter(stock_item=item).first()
        self.assertIsNotNone(attachment)
