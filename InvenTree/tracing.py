"""OpenTelemetry setup functions."""

import logging

from opentelemetry import metrics, trace
from opentelemetry.exporter.otlp.proto.grpc._log_exporter import OTLPLogExporter
from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.django import DjangoInstrumentor
from opentelemetry.instrumentation.redis import RedisInstrumentor
from opentelemetry.instrumentation.requests import RequestsInstrumentor
from opentelemetry.sdk import _logs as logs
from opentelemetry.sdk import resources
from opentelemetry.sdk._logs import export as logs_export
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import (
    ConsoleMetricExporter,
    PeriodicExportingMetricReader,
)
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter

from InvenTree.config import get_boolean_setting, get_setting


def tracing_enabled():
    """Return True if tracing is possible."""
    return get_boolean_setting('INVENTREE_TRACING_ENABLED', 'tracing_enabled', False)


def setup_tracing():
    """Setup tracing for the application in the current context."""
    if not tracing_enabled():
        return

    # Gather the required environment variables
    headers, endpoint, resource = setup_src()
    console_log = False

    # Spans / Tracs
    span_exporter = OTLPSpanExporter(headers=headers, endpoint=endpoint)
    trace_processor = BatchSpanProcessor(span_exporter)
    trace_provider = TracerProvider(resource=resource)
    trace.set_tracer_provider(trace_provider)
    trace_provider.add_span_processor(trace_processor)
    # For debugging purposes, export the traces to the console
    if console_log:
        trace_provider.add_span_processor(BatchSpanProcessor(ConsoleSpanExporter()))

    # Metrics
    metric_perodic_reader = PeriodicExportingMetricReader(
        OTLPMetricExporter(headers=headers, endpoint=endpoint)
    )
    metric_readers = [metric_perodic_reader]

    # For debugging purposes, export the metrics to the console
    if console_log:
        console_metric_exporter = ConsoleMetricExporter()
        console_metric_reader = PeriodicExportingMetricReader(console_metric_exporter)
        metric_readers.append(console_metric_reader)

    meter_provider = MeterProvider(resource=resource, metric_readers=metric_readers)
    metrics.set_meter_provider(meter_provider)

    # Logs
    log_exporter = OTLPLogExporter(headers=headers, endpoint=endpoint)
    log_provider = logs.LoggerProvider(resource=resource)
    log_provider.add_log_record_processor(
        logs_export.BatchLogRecordProcessor(log_exporter)
    )
    handler = logs.LoggingHandler(level=logging.INFO, logger_provider=log_provider)
    logger = logging.getLogger('inventree')
    logger.addHandler(handler)


def setup_src():
    """Parsing the variables for the OpenTelemetry exporter."""
    headers = get_setting('INVENTREE_TRACING_HEADERS', 'tracing_headers', None, dict)
    endpoint = get_setting('INVENTREE_TRACING_ENDPOINT', 'tracing_endpoint', None)

    # Initialize the OTLP Resource
    resource = resources.Resource(
        attributes={
            resources.SERVICE_NAME: 'BACKEND',
            resources.SERVICE_NAMESPACE: 'INVENTREE',
        }
    )

    return headers, endpoint, resource


def setup_instruments():
    """Run auto-insturmentation for OpenTelemetry tracing."""
    if not tracing_enabled():
        return

    DjangoInstrumentor().instrument()
    RedisInstrumentor().instrument()
    RequestsInstrumentor().instrument()
