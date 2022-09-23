# Generated by Django 3.2.15 on 2022-09-23 01:41

import InvenTree.fields
from django.db import migrations, models
import django.db.models.deletion
import djmoney.models.fields
import djmoney.models.validators


class Migration(migrations.Migration):

    dependencies = [
        ('part', '0086_auto_20220912_0007'),
    ]

    operations = [
        migrations.CreateModel(
            name='PartPricing',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('bom_cost_min_currency', djmoney.models.fields.CurrencyField(choices=[], default='', editable=False, max_length=3)),
                ('bom_cost_min', InvenTree.fields.InvenTreeModelMoneyField(currency_choices=[], decimal_places=6, default_currency='', help_text='Minimum cost of component parts', max_digits=19, null=True, validators=[djmoney.models.validators.MinMoneyValidator(0)], verbose_name='Minimum BOM Cost')),
                ('bom_cost_max_currency', djmoney.models.fields.CurrencyField(choices=[], default='', editable=False, max_length=3)),
                ('bom_cost_max', InvenTree.fields.InvenTreeModelMoneyField(currency_choices=[], decimal_places=6, default_currency='', help_text='Maximum cost of component parts', max_digits=19, null=True, validators=[djmoney.models.validators.MinMoneyValidator(0)], verbose_name='Maximum BOM Cost')),
                ('purchase_cost_min_currency', djmoney.models.fields.CurrencyField(choices=[], default='', editable=False, max_length=3)),
                ('purchase_cost_min', InvenTree.fields.InvenTreeModelMoneyField(currency_choices=[], decimal_places=6, default_currency='', help_text='Minimum historical purchase cost', max_digits=19, null=True, validators=[djmoney.models.validators.MinMoneyValidator(0)], verbose_name='Minimum Purchase Cost')),
                ('purchase_cost_max_currency', djmoney.models.fields.CurrencyField(choices=[], default='', editable=False, max_length=3)),
                ('purchase_cost_max', InvenTree.fields.InvenTreeModelMoneyField(currency_choices=[], decimal_places=6, default_currency='', help_text='Maximum historical purchase cost', max_digits=19, null=True, validators=[djmoney.models.validators.MinMoneyValidator(0)], verbose_name='Maximum Purchase Cost')),
                ('internal_cost_min_currency', djmoney.models.fields.CurrencyField(choices=[], default='', editable=False, max_length=3)),
                ('internal_cost_min', InvenTree.fields.InvenTreeModelMoneyField(currency_choices=[], decimal_places=6, default_currency='', help_text='Minimum cost based on internal price breaks', max_digits=19, null=True, validators=[djmoney.models.validators.MinMoneyValidator(0)], verbose_name='Minimum Internal Cost')),
                ('internal_cost_max_currency', djmoney.models.fields.CurrencyField(choices=[], default='', editable=False, max_length=3)),
                ('internal_cost_max', InvenTree.fields.InvenTreeModelMoneyField(currency_choices=[], decimal_places=6, default_currency='', help_text='Maximum cost based on internal price breaks', max_digits=19, null=True, validators=[djmoney.models.validators.MinMoneyValidator(0)], verbose_name='Maximum Internal Cost')),
                ('supplier_price_min_currency', djmoney.models.fields.CurrencyField(choices=[], default='', editable=False, max_length=3)),
                ('supplier_price_min', InvenTree.fields.InvenTreeModelMoneyField(currency_choices=[], decimal_places=6, default_currency='', help_text='Minimum price of part from external suppliers', max_digits=19, null=True, validators=[djmoney.models.validators.MinMoneyValidator(0)], verbose_name='Minimum Supplier Price')),
                ('supplier_price_max_currency', djmoney.models.fields.CurrencyField(choices=[], default='', editable=False, max_length=3)),
                ('supplier_price_max', InvenTree.fields.InvenTreeModelMoneyField(currency_choices=[], decimal_places=6, default_currency='', help_text='Maximum price of part from external suppliers', max_digits=19, null=True, validators=[djmoney.models.validators.MinMoneyValidator(0)], verbose_name='Maximum Supplier Price')),
                ('overall_min_currency', djmoney.models.fields.CurrencyField(choices=[], default='', editable=False, max_length=3)),
                ('overall_min', InvenTree.fields.InvenTreeModelMoneyField(currency_choices=[], decimal_places=6, default_currency='', help_text='Calculated overall minimum cost', max_digits=19, null=True, validators=[djmoney.models.validators.MinMoneyValidator(0)], verbose_name='Minimum Cost')),
                ('overall_max_currency', djmoney.models.fields.CurrencyField(choices=[], default='', editable=False, max_length=3)),
                ('overall_max', InvenTree.fields.InvenTreeModelMoneyField(currency_choices=[], decimal_places=6, default_currency='', help_text='Calculated overall maximum cost', max_digits=19, null=True, validators=[djmoney.models.validators.MinMoneyValidator(0)], verbose_name='Maximum Cost')),
                ('part', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='pricing_data', to='part.part', verbose_name='Part')),
            ],
        ),
    ]
