import test from 'node:test';
import assert from 'node:assert/strict';
import { redactSensitive } from '../src/logger';
import { MetricsRegistry } from '../src/metrics';
import { createTraceContext, parseTraceparent } from '../src/tracing';

test('redacts sensitive values recursively without removing safe operation metadata', () => {
  const result: any = redactSensitive({ operation: 'campaign.dispatch', authorization: 'Bearer secret', nested: { otp: '123456', providerMessageId: 'wamid.1' } });
  assert.equal(result.operation, 'campaign.dispatch');
  assert.equal(result.authorization, '[REDACTED]');
  assert.equal(result.nested.otp, '[REDACTED]');
  assert.equal(result.nested.providerMessageId, 'wamid.1');
});

test('renders bounded-label Prometheus counters, gauges, and histograms', () => {
  const registry = new MetricsRegistry('test-service');
  registry.increment('requests_total', 'Requests', { method: 'GET', status_class: '2xx' });
  registry.gauge('queue_jobs', 'Jobs', 3, { queue_name: 'campaign', state: 'waiting' });
  registry.observe('request_duration_seconds', 'Duration', 0.2, { method: 'GET' });
  const output = registry.render();
  assert.match(output, /requests_total/);
  assert.match(output, /queue_jobs/);
  assert.match(output, /request_duration_seconds_bucket/);
  assert.doesNotMatch(output, /workspaceId|requestId|userId/);
});

test('continues an incoming W3C trace and rejects malformed traceparent values', () => {
  const incoming = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';
  const trace = createTraceContext(incoming);
  assert.equal(trace.traceId, '4bf92f3577b34da6a3ce929d0e0e4736');
  assert.equal(parseTraceparent(trace.traceparent)?.traceId, trace.traceId);
  assert.equal(parseTraceparent('invalid'), null);
});