# Generated by Django 3.2.19 on 2023-05-31 12:05

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('part', '0111_auto_20230521_1350'),
    ]

    operations = [
        migrations.AddField(
            model_name='partparametertemplate',
            name='checkbox',
            field=models.BooleanField(default=False, help_text='Is this parameter a checkbox?', verbose_name='Checkbox'),
        ),
        migrations.AddField(
            model_name='partparametertemplate',
            name='choices',
            field=models.CharField(blank=True, help_text='Valid choices for this parameter (comma-separated)', max_length=5000, verbose_name='Choices'),
        ),
    ]
