# Generated by Django 3.2.20 on 2023-08-05 17:48

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('plugin', '0006_pluginconfig_metadata'),
    ]

    operations = [
        migrations.AlterField(
            model_name='notificationusersetting',
            name='value',
            field=models.CharField(blank=True, help_text='Settings value', max_length=2000),
        ),
        migrations.AlterField(
            model_name='pluginsetting',
            name='value',
            field=models.CharField(blank=True, help_text='Settings value', max_length=2000),
        ),
    ]
