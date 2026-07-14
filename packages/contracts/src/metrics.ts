type Labels = Record<string, string | number | boolean | undefined>;

const metricName = /^[a-zA-Z_:][a-zA-Z0-9_:]*$/;
const labelName = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function escapeLabel(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"');
}

function keyFor(labels: Labels) {
  return Object.entries(labels).filter(([, value]) => value !== undefined).sort(([a], [b]) => a.localeCompare(b));
}

export class MetricsRegistry {
  private counters = new Map<string, { name: string; help: string; labels: [string, unknown][]; value: number }>();
  private gauges = new Map<string, { name: string; help: string; labels: [string, unknown][]; value: number }>();
  private histograms = new Map<string, { name: string; help: string; labels: [string, unknown][]; count: number; sum: number; buckets: number[]; values: number[] }>();

  constructor(private readonly service: string) {}

  increment(name: string, help: string, labels: Labels = {}, amount = 1) {
    this.assert(name, labels);
    const merged = { service: this.service, ...labels };
    const pairs = keyFor(merged);
    const key = `${name}:${JSON.stringify(pairs)}`;
    const metric = this.counters.get(key) || { name, help, labels: pairs, value: 0 };
    metric.value += amount;
    this.counters.set(key, metric);
  }

  gauge(name: string, help: string, value: number, labels: Labels = {}) {
    this.assert(name, labels);
    const pairs = keyFor({ service: this.service, ...labels });
    this.gauges.set(`${name}:${JSON.stringify(pairs)}`, { name, help, labels: pairs, value });
  }

  observe(name: string, help: string, value: number, labels: Labels = {}, buckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]) {
    this.assert(name, labels);
    const pairs = keyFor({ service: this.service, ...labels });
    const key = `${name}:${JSON.stringify(pairs)}`;
    const metric = this.histograms.get(key) || { name, help, labels: pairs, count: 0, sum: 0, buckets, values: buckets.map(() => 0) };
    metric.count += 1;
    metric.sum += value;
    metric.values = metric.values.map((count, index) => count + (value <= metric.buckets[index] ? 1 : 0));
    this.histograms.set(key, metric);
  }

  middleware() {
    return (req: any, res: any, next: any) => {
      const start = process.hrtime.bigint();
      res.on('finish', () => {
        const route = String(req.route?.path || req.baseUrl || req.path || 'unknown').replace(/[0-9a-f]{24}|\d+/gi, ':id');
        const labels = { method: req.method, route, status_class: `${Math.floor(res.statusCode / 100)}xx` };
        this.increment('http_requests_total', 'HTTP requests received', labels);
        if (res.statusCode >= 400) this.increment('http_errors_total', 'HTTP error responses', labels);
        this.observe('http_request_duration_seconds', 'HTTP request duration', Number(process.hrtime.bigint() - start) / 1e9, labels);
      });
      next();
    };
  }

  render() {
    const lines: string[] = [];
    const seen = new Set<string>();
    const labels = (pairs: [string, unknown][]) => pairs.length ? `{${pairs.map(([key, value]) => `${key}="${escapeLabel(String(value))}"`).join(',')}}` : '';
    for (const metric of [...this.counters.values(), ...this.gauges.values()]) {
      if (!seen.has(metric.name)) { lines.push(`# HELP ${metric.name} ${metric.help}`, `# TYPE ${metric.name} ${this.counters.has(`${metric.name}:${JSON.stringify(metric.labels)}`) ? 'counter' : 'gauge'}`); seen.add(metric.name); }
      lines.push(`${metric.name}${labels(metric.labels)} ${metric.value}`);
    }
    for (const metric of this.histograms.values()) {
      if (!seen.has(metric.name)) { lines.push(`# HELP ${metric.name} ${metric.help}`, `# TYPE ${metric.name} histogram`); seen.add(metric.name); }
      metric.buckets.forEach((bucket, index) => lines.push(`${metric.name}_bucket${labels([...metric.labels, ['le', bucket]])} ${metric.values[index]}`));
      lines.push(`${metric.name}_bucket${labels([...metric.labels, ['le', '+Inf']])} ${metric.count}`);
      lines.push(`${metric.name}_sum${labels(metric.labels)} ${metric.sum}`, `${metric.name}_count${labels(metric.labels)} ${metric.count}`);
    }
    return `${lines.join('\n')}\n`;
  }

  private assert(name: string, labels: Labels) {
    if (!metricName.test(name)) throw new Error(`Invalid metric name: ${name}`);
    for (const key of Object.keys(labels)) if (!labelName.test(key)) throw new Error(`Invalid metric label: ${key}`);
  }
}

export function metricsEndpoint(registry: MetricsRegistry) {
  return (_req: any, res: any) => {
    res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(registry.render());
  };
}