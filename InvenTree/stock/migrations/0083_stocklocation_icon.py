# Generated by Django 3.2.15 on 2022-08-15 08:38

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('stock', '0082_alter_stockitem_link'),
    ]

    operations = [
        migrations.AddField(
            model_name='stocklocation',
            name='icon',
            field=models.CharField(blank=True, help_text='Icon (optional)', max_length=100, verbose_name='Icon'),
        ),
    ]
