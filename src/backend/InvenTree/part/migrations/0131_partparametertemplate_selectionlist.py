# Generated by Django 4.2.16 on 2024-11-04 23:35

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('common', '0032_selectionlist_selectionlistentry_and_more'),
        ('part', '0130_alter_parttesttemplate_part'),
    ]

    operations = [
        migrations.AddField(
            model_name='partparametertemplate',
            name='selectionlist',
            field=models.ForeignKey(
                blank=True,
                help_text='Selection list for this parameter',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='parameter_templates',
                to='common.selectionlist',
                verbose_name='Selection List',
            ),
        )
    ]
