"""API functionality for the 'report' app."""

from django.core.exceptions import ValidationError
from django.http import HttpResponse, JsonResponse, StreamingHttpResponse
from django.template.exceptions import TemplateDoesNotExist
from django.urls import include, path
from django.utils.decorators import method_decorator
from django.utils.translation import gettext_lazy as _
from django.views.decorators.cache import cache_page, never_cache

from django_filters import rest_framework as rest_filters
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import serializers
from rest_framework.exceptions import NotFound
from rest_framework.request import clone_request
from rest_framework.response import Response

import common.models
import InvenTree.exceptions
import InvenTree.helpers
import report.helpers
import report.models
import report.serializers
from InvenTree.api import MetadataView
from InvenTree.exceptions import log_error
from InvenTree.filters import InvenTreeSearchFilter
from InvenTree.mixins import (
    ListAPI,
    ListCreateAPI,
    RetrieveAPI,
    RetrieveUpdateDestroyAPI,
)
from plugin.builtin.labels.inventree_label import InvenTreeLabelPlugin
from plugin.registry import registry


@method_decorator(cache_page(5), name='dispatch')
class TemplatePrintBase(RetrieveAPI):
    """Base class for printing against templates."""

    @method_decorator(never_cache)
    def dispatch(self, *args, **kwargs):
        """Prevent caching when printing report templates."""
        return super().dispatch(*args, **kwargs)

    def check_permissions(self, request):
        """Override request method to GET so that also non superusers can print using a post request."""
        if request.method == 'POST':
            request = clone_request(request, 'GET')
        return super().check_permissions(request)

    def post(self, request, *args, **kwargs):
        """Respond as if a POST request was provided."""
        return self.get(request, *args, **kwargs)

    def get(self, request, *args, **kwargs):
        """GET action for a template printing endpoint.

        - Items are expected to be passed as a list of valid IDs
        """
        # Extract a list of items to print from the queryset
        item_ids = []

        for value in request.query_params.get('items', '').split(','):
            try:
                item_ids.append(int(value))
            except Exception:
                pass

        template = self.get_object()

        items = template.get_model().objects.filter(pk__in=item_ids)

        if len(items) == 0:
            # At least one item must be provided
            return Response(
                {'error': _('No valid objects provided to template')}, status=400
            )

        return self.print(request, items)


class ReportFilterBase(rest_filters.FilterSet):
    """Base filter class for label and report templates."""

    enabled = rest_filters.BooleanFilter()

    model_type = rest_filters.ChoiceFilter(
        choices=report.helpers.report_model_options(), label=_('Model Type')
    )

    items = rest_filters.CharFilter(method='filter_items', label=_('Items'))
    # items = rest_filters.AllValuesMultipleFilter(method='filter_items', label=_('Items'))

    def filter_items(self, queryset, name, values):
        """Filter against a comma-separated list of provided items.

        Note: This filter is only applied if the 'model_type' is also provided.
        """
        model_type = self.data.get('model_type', None)
        values = values.strip().split(',')

        if model_class := report.helpers.report_model_from_name(model_type):
            model_items = model_class.objects.filter(pk__in=values)

            # Ensure that we have already filtered by model_type
            queryset = queryset.filter(model_type=model_type)

            # Construct a list of templates which match the list of provided IDs
            matching_template_ids = []

            for template in queryset.all():
                filters = template.get_filters()
                results = model_items.filter(**filters)
                # If the resulting queryset is *shorter* than the provided items, then this template does not match
                if results.count() == model_items.count():
                    matching_template_ids.append(template.pk)

            queryset = queryset.filter(pk__in=matching_template_ids)

        return queryset


class ReportFilter(ReportFilterBase):
    """Filter class for report template list."""

    class Meta:
        """Filter options."""

        model = report.models.ReportTemplate
        fields = ['landscape']


class LabelFilter(ReportFilterBase):
    """Filter class for label template list."""

    class Meta:
        """Filter options."""

        model = report.models.LabelTemplate
        fields = []


class LabelTemplatePrint(TemplatePrintBase):
    """API endpoint for printing labels against a specified template."""

    queryset = report.models.LabelTemplate.objects.all()

    def get_serializer(self, *args, **kwargs):
        """Define a get_serializer method to be discoverable by the OPTIONS request."""
        # Check the request to determine if the user has selected a label printing plugin
        plugin = self.get_plugin(self.request)

        kwargs.setdefault('context', self.get_serializer_context())
        serializer = plugin.get_printing_options_serializer(
            self.request, *args, **kwargs
        )

        # if no serializer is defined, return an empty serializer
        if not serializer:
            return serializers.Serializer()

        return serializer

    def get_plugin(self, request):
        """Return the label printing plugin associated with this request.

        This is provided in the URL, e.g. ?plugin=myprinter
        """
        plugin_key = request.query_params.get(
            'plugin', InvenTreeLabelPlugin.NAME.lower()
        )
        plugin = registry.get_plugin(plugin_key)

        if not plugin:
            raise NotFound(f"Plugin '{plugin_key}' not found")

        if not plugin.is_active():
            raise ValidationError(f"Plugin '{plugin_key}' is not enabled")

        if not plugin.mixin_enabled('labels'):
            raise ValidationError(
                f"Plugin '{plugin_key}' is not a label printing plugin"
            )

        # Only return the plugin if it is enabled and has the label printing mixin
        return plugin

    def print(self, request, items_to_print):
        """Print this label template against a number of provided items."""
        plugin = self.get_plugin(request)
        label = self.get_object()

        if len(items_to_print) == 0:
            raise ValidationError('No items provided to print')

        # Check the label dimensions
        if label.width <= 0 or label.height <= 0:
            raise ValidationError('Label has invalid dimensions')

        if serializer := plugin.get_printing_options_serializer(
            request, data=request.data, context=self.get_serializer_context()
        ):
            serializer.is_valid(raise_exception=True)

        # At this point, we offload the label(s) to the selected plugin.
        # The plugin is responsible for handling the request and returning a response.
        output = report.models.LabelOutput.objects.create(
            template=label,
            items=len(items_to_print),
            plugin=plugin.slug,
            user=request.user,
            progress=0,
            complete=False,
        )

        try:
            plugin.print_labels(
                label,
                output,
                items_to_print,
                request,
                printing_options=(serializer.data if serializer else {}),
            )
        except ValidationError as e:
            raise (e)
        except Exception as e:
            InvenTree.exceptions.log_error(f'plugins.{plugin.slug}.print_labels')
            raise ValidationError([_('Error printing label'), str(e)])

        output.refresh_from_db()

        return Response(
            report.serializers.LabelOutputSerializer(output).data, status=201
        )


class LabelTemplateList(ListCreateAPI):
    """API endpoint for viewing list of LabelTemplate objects."""

    queryset = report.models.LabelTemplate.objects.all()
    serializer_class = report.serializers.LabelTemplateSerializer
    filterset_class = LabelFilter
    filter_backends = [DjangoFilterBackend, InvenTreeSearchFilter]
    search_fields = ['name', 'description']
    ordering_fields = ['name', 'enabled']


class LabelTemplateDetail(RetrieveUpdateDestroyAPI):
    """Detail API endpoint for label template model."""

    queryset = report.models.LabelTemplate.objects.all()
    serializer_class = report.serializers.ReportTemplateSerializer


class ReportTemplatePrint(TemplatePrintBase):
    """API endpoint for printing reports against a specified template."""

    queryset = report.models.ReportTemplate.objects.all()

    def get_serializer(self, *args, **kwargs):
        """Serializer for printing."""
        return serializers.Serializer()

    def print(self, request, items_to_print):
        """Print this report template against a number of provided items."""
        report = self.get_object()
        outputs = []

        # In debug mode, generate single HTML output, rather than PDF
        debug_mode = common.models.InvenTreeSetting.get_setting(
            'REPORT_DEBUG_MODE', cache=False
        )

        # Start with a default report name
        report_name = 'report.pdf'

        try:
            # Merge one or more PDF files into a single download
            for instance in items_to_print:
                report_name = report.generate_filename(request)

                output = report.render(instance, request)

                # Provide generated report to any interested plugins
                for plugin in registry.with_mixin('report'):
                    try:
                        plugin.report_callback(self, instance, output, request)
                    except Exception as e:
                        InvenTree.exceptions.log_error(
                            f'plugins.{plugin.slug}.report_callback'
                        )

                try:
                    if debug_mode:
                        outputs.append(report.render_as_string(instance, request))
                    else:
                        outputs.append(report.render(instance, request))
                except TemplateDoesNotExist as e:
                    template = str(e)
                    if not template:
                        template = report.template

                    return Response(
                        {
                            'error': _(
                                f"Template file '{template}' is missing or does not exist"
                            )
                        },
                        status=400,
                    )

            if not report_name.endswith('.pdf'):
                report_name += '.pdf'

            if debug_mode:
                """Concatenate all rendered templates into a single HTML string, and return the string as a HTML response."""

                html = '\n'.join(outputs)

                return HttpResponse(html)
            else:
                """Concatenate all rendered pages into a single PDF object, and return the resulting document!"""

                pages = []

                try:
                    for output in outputs:
                        doc = output.get_document()
                        for page in doc.pages:
                            pages.append(page)

                    pdf = outputs[0].get_document().copy(pages).write_pdf()

                except TemplateDoesNotExist as e:
                    template = str(e)

                    if not template:
                        template = report.template

                    return Response(
                        {
                            'error': _(
                                f"Template file '{template}' is missing or does not exist"
                            )
                        },
                        status=400,
                    )

                inline = common.models.InvenTreeUserSetting.get_setting(
                    'REPORT_INLINE', user=request.user, cache=False
                )

                return InvenTree.helpers.DownloadFile(
                    pdf, report_name, content_type='application/pdf', inline=inline
                )

        except Exception as exc:
            # Log the exception to the database
            if InvenTree.helpers.str2bool(
                common.models.InvenTreeSetting.get_setting(
                    'REPORT_LOG_ERRORS', cache=False
                )
            ):
                log_error(request.path)

            # Re-throw the exception to the client as a DRF exception
            raise ValidationError({
                'error': 'Report printing failed',
                'detail': str(exc),
                'path': request.path,
            })


class ReportTemplateList(ListCreateAPI):
    """API endpoint for viewing list of ReportTemplate objects."""

    queryset = report.models.ReportTemplate.objects.all()
    serializer_class = report.serializers.ReportTemplateSerializer
    filterset_class = ReportFilter
    filter_backends = [DjangoFilterBackend, InvenTreeSearchFilter]
    search_fields = ['name', 'description']
    ordering_fields = ['name', 'enabled']


class ReportTemplateDetail(RetrieveUpdateDestroyAPI):
    """Detail API endpoint for report template model."""

    queryset = report.models.ReportTemplate.objects.all()
    serializer_class = report.serializers.ReportTemplateSerializer


class ReportSnippetList(ListCreateAPI):
    """API endpoint for listing ReportSnippet objects."""

    queryset = report.models.ReportSnippet.objects.all()
    serializer_class = report.serializers.ReportSnippetSerializer


class ReportSnippetDetail(RetrieveUpdateDestroyAPI):
    """API endpoint for a single ReportSnippet object."""

    queryset = report.models.ReportSnippet.objects.all()
    serializer_class = report.serializers.ReportSnippetSerializer


class ReportAssetList(ListCreateAPI):
    """API endpoint for listing ReportAsset objects."""

    queryset = report.models.ReportAsset.objects.all()
    serializer_class = report.serializers.ReportAssetSerializer


class ReportAssetDetail(RetrieveUpdateDestroyAPI):
    """API endpoint for a single ReportAsset object."""

    queryset = report.models.ReportAsset.objects.all()
    serializer_class = report.serializers.ReportAssetSerializer


class LabelOutputList(ListAPI):
    """List endpoint for LabelOutput objects."""

    queryset = report.models.LabelOutput.objects.all()
    serializer_class = report.serializers.LabelOutputSerializer


class LabelOutputDetail(RetrieveAPI):
    """Detail endpoint for a single LabelOutput object."""

    queryset = report.models.LabelOutput.objects.all()
    serializer_class = report.serializers.LabelOutputSerializer


label_api_urls = [
    # Label templates
    path(
        'template/',
        include([
            path(
                '<int:pk>/',
                include([
                    path(
                        'print/',
                        LabelTemplatePrint.as_view(),
                        name='api-label-template-print',
                    ),
                    path(
                        'metadata/',
                        MetadataView.as_view(),
                        {'model': report.models.LabelTemplate},
                        name='api-label-template-metadata',
                    ),
                    path(
                        '',
                        LabelTemplateDetail.as_view(),
                        name='api-label-template-detail',
                    ),
                ]),
            ),
            path('', LabelTemplateList.as_view(), name='api-label-template-list'),
        ]),
    ),
    # Label outputs
    path(
        'output/',
        include([
            path(
                '<int:pk>/', LabelOutputDetail.as_view(), name='api-label-output-detail'
            ),
            path('', LabelOutputList.as_view(), name='api-label-output-list'),
        ]),
    ),
]

report_api_urls = [
    # Report templates
    path(
        'template/',
        include([
            path(
                '<int:pk>/',
                include([
                    path(
                        'print/',
                        ReportTemplatePrint.as_view(),
                        name='api-report-template-print',
                    ),
                    path(
                        'metadata/',
                        MetadataView.as_view(),
                        {'model': report.models.ReportTemplate},
                        name='api-report-template-metadata',
                    ),
                    path(
                        '',
                        ReportTemplateDetail.as_view(),
                        name='api-report-template-detail',
                    ),
                ]),
            ),
            path('', ReportTemplateList.as_view(), name='api-report-template-list'),
        ]),
    ),
    # Report assets
    path(
        'asset/',
        include([
            path(
                '<int:pk>/', ReportAssetDetail.as_view(), name='api-report-asset-detail'
            ),
            path('', ReportAssetList.as_view(), name='api-report-asset-list'),
        ]),
    ),
    # Report snippets
    path(
        'snippet/',
        include([
            path(
                '<int:pk>/',
                ReportSnippetDetail.as_view(),
                name='api-report-snippet-detail',
            ),
            path('', ReportSnippetList.as_view(), name='api-report-snippet-list'),
        ]),
    ),
]
