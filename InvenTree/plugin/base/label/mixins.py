"""Plugin mixin classes for label plugins."""

from django.http import JsonResponse

import pdf2image

from common.models import InvenTreeSetting
from InvenTree.tasks import offload_task
from label.models import LabelTemplate
from plugin.base.label import label as plugin_label
from plugin.helpers import MixinNotImplementedError


class LabelPrintingMixin:
    """Mixin which enables direct printing of stock labels.

    Each plugin must provide a NAME attribute, which is used to uniquely identify the printer.

    The plugin must also implement the print_label() function
    """

    # If True, the print_label() method will block until the label is printed
    # If False, the offload_label() method will be called instead
    BLOCKING_PRINT = True

    class MixinMeta:
        """Meta options for this mixin."""
        MIXIN_NAME = 'Label printing'

    def __init__(self):  # pragma: no cover
        """Register mixin."""
        super().__init__()
        self.add_mixin('labels', True, __class__)

    def render_to_pdf(self, label: LabelTemplate, request, **kwargs):
        """Render this label to PDF format

        Arguments:
            label: The LabelTemplate object to render
            request: The HTTP request object which triggered this print job
        """
        return label.render(request)

    def render_to_html(self, label: LabelTemplate, request, **kwargs):
        """Render this label to HTML format

        Arguments:
            label: The LabelTemplate object to render
            request: The HTTP request object which triggered this print job
        """
        return label.render_as_string(request)

    def render_to_png(self, label: LabelTemplate, request=None, **kwargs):
        """Render this label to PNG format"""

        # Check if pdf data is provided
        pdf = kwargs.get('pdf_data', None)

        if not pdf:
            pdf = self.render_to_pdf(label, request, **kwargs)

        dpi = kwargs.get(
            'dpi',
            InvenTreeSetting.get_setting('LABEL_DPI', 300)
        )

        # Convert to png data
        png = pdf2image.convert_from_bytes(pdf, dpi)[0]
        return png

    def print_labels(self, labels: list[LabelTemplate], request, **kwargs):
        """Print one or more labels.

        Arguments:
            labels: A list of LabelTemplate objects to print
            request: The HTTP request object which triggered this print job

        kwargs:
            user: The user who triggered this print job
            copies: The number of copies to print

        The default implementation simply calls print_label() for each label, producing multiple single label output "jobs"
        but this can be overridden by the particular plugin.
        """

        try:
            user = request.user
        except AttributeError:
            user = None

        for label in labels:

            pdf_file = self.render_to_pdf(label, request, **kwargs)

            print_args = {
                'pdf_data': pdf_file,
                'filename': label.filename,
                'label_instance': label,
                'user': user,
                'width': label.width,
                'height': label.height,
            }

            if self.BLOCKING_PRINT:
                # Blocking print job
                self.print_label(**print_args)
            else:
                # Non-blocking print job
                self.offload_label(**print_args)

            # Call the print_label() method for each label
            # Note that this is a blocking process, and will not return until the label is printed
            # An alternative is to call the offload_label() method, which will offload the print job to a background worker
            self.print_label(label, request, **kwargs)

        return JsonResponse({
            'plugin': self.plugin_slug(),
            'success': True,
            'message': f'{len(labels)} labels printed',
        })

    def print_label(self, **kwargs):
        """Print a single label (blocking)

        kwargs:
            pdf_data: Raw PDF data of the rendered label
            filename: The filename of this PDF label
            label_instance: The instance of the label model which triggered the print_label() method
            user: The user who triggered this print job
            width: The expected width of the label (in mm)
            height: The expected height of the label (in mm)
        """
        # Unimplemented (to be implemented by the particular plugin class)
        raise MixinNotImplementedError('This Plugin must implement a `print_label` method')

    def offload_label(self, **kwargs):
        """Offload a single label (non-blocking)

        Instead of immediately printing the label (which is a blocking process),
        this method should offload the label to a background worker process.

        Offloads a call to the 'print_label' method (of this plugin) to a background worker.
        """

        offload_task(
            plugin_label.print_label,
            self.plugin_slug(),
            **kwargs
        )
