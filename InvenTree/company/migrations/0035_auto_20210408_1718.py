# Generated by Django 3.0.7 on 2021-04-08 17:18

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('company', '0034_supplierpart_update'),
    ]

    operations = [
        migrations.AlterField(
            model_name='company',
            name='description',
            field=models.CharField(blank=True, help_text='Description of the company', max_length=500, verbose_name='Company description'),
        ),
    ]
