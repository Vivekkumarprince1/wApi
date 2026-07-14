import crypto from 'node:crypto';

const TRACEPARENT = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/i;

export function parseTraceparent(value?: string | null) {
  const match = value?.match(TRACEPARENT);
  return match ? { traceId: match[1].toLowerCase(), parentSpanId: match[2].toLowerCase(), flags: match[3].toLowerCase() } : null;
}

export function createTraceContext(incoming?: string | null) {
  const parsed = parseTraceparent(incoming);
  const traceId = parsed?.traceId || crypto.randomBytes(16).toString('hex');
  const spanId = crypto.randomBytes(8).toString('hex');
  return { traceId, spanId, traceparent: `00-${traceId}-${spanId}-${parsed?.flags || '01'}` };
}

export function tracingMiddleware() {
  return (req: any, res: any, next: any) => {
    const trace = createTraceContext(req.headers.traceparent);
    req.traceContext = trace;
    req.headers.traceparent = trace.traceparent;
    res.setHeader('traceparent', trace.traceparent);
    next();
  };
}