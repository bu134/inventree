# Generated by Django 4.2.11 on 2024-04-22 12:48

import InvenTree.models
import django.core.validators
from django.db import migrations, models
import report.models
import report.validators


class Migration(migrations.Migration):

    dependencies = [
        ('report', '0024_delete_billofmaterialsreport_delete_buildreport_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='LabelTemplate',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('metadata', models.JSONField(blank=True, help_text='JSON metadata field, for use by external plugins', null=True, verbose_name='Plugin Metadata')),
                ('name', models.CharField(help_text='Template name', max_length=100, unique=True, verbose_name='Name')),
                ('description', models.CharField(help_text='Template description', max_length=250, verbose_name='Description')),
                ('template', models.FileField(help_text='Template file', upload_to='label_template', validators=[django.core.validators.FileExtensionValidator(allowed_extensions=['html', 'htm'])], verbose_name='Template')),
                ('revision', models.PositiveIntegerField(default=1, editable=False, help_text='Revision number (auto-increments)', verbose_name='Revision')),
                ('filename_pattern', models.CharField(default='report.pdf', help_text='Pattern for generating filenames', max_length=100, verbose_name='Filename Pattern')),
                ('enabled', models.BooleanField(default=True, help_text='Template is enabled', verbose_name='Enabled')),
                ('model_type', models.CharField(max_length=100, validators=[report.validators.validate_report_model_type])),
                ('filters', models.CharField(blank=True, help_text='Template query filters (comma-separated list of key=value pairs)', max_length=250, validators=[report.validators.validate_filters], verbose_name='Filters')),
                ('width', models.FloatField(default=50, help_text='Label width, specified in mm', validators=[django.core.validators.MinValueValidator(2)], verbose_name='Width [mm]')),
                ('height', models.FloatField(default=20, help_text='Label height, specified in mm', validators=[django.core.validators.MinValueValidator(2)], verbose_name='Height [mm]')),
            ],
            options={
                'abstract': False,
                'unique_together': {('name', 'model_type')},
            },
            bases=(InvenTree.models.PluginValidationMixin, models.Model),
        ),
    ]
