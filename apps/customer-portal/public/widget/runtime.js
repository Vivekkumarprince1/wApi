(function () {
  var script = document.currentScript;
  if (!script || script.dataset.connectsphereMounted === 'true') return;
  script.dataset.connectsphereMounted = 'true';

  var widgetId = script.getAttribute('data-connectsphere-id') || script.getAttribute('data-id');
  if (!widgetId) return;

  var scriptUrl = new URL(script.src, window.location.href);
  var origin = script.getAttribute('data-api-origin') || scriptUrl.origin;
  var rootId = 'connectsphere-widget-root-' + widgetId.replace(/[^a-zA-Z0-9_-]/g, '');

  function postEvent(type) {
    try {
      fetch(origin + '/api/v1/widget/public/' + encodeURIComponent(widgetId) + '/events', {
        method: 'POST',
        mode: 'cors',
        keepalive: true,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: type,
          pageUrl: window.location.href,
          referrer: document.referrer || ''
        })
      }).catch(function () {});
    } catch (_) {}
  }

  function isAllowed(config) {
    var path = window.location.pathname || '/';
    var allowed = (config.behavior && config.behavior.allowedPages) || ['*'];
    var excluded = (config.behavior && config.behavior.excludedPages) || [];
    var matches = function (pattern) {
      if (!pattern || pattern === '*') return true;
      if (pattern.endsWith('*')) return path.indexOf(pattern.slice(0, -1)) === 0;
      return path === pattern;
    };
    return allowed.some(matches) && !excluded.some(matches);
  }

  function positionStyles(position) {
    var base = 'position:fixed;z-index:2147483000;display:flex;flex-direction:column;gap:10px;';
    if (position === 'bottom-left') return base + 'left:20px;bottom:20px;align-items:flex-start;';
    if (position === 'top-right') return base + 'right:20px;top:20px;align-items:flex-end;';
    if (position === 'top-left') return base + 'left:20px;top:20px;align-items:flex-start;';
    if (position === 'full-width-bottom') return base + 'left:20px;right:20px;bottom:20px;align-items:stretch;';
    return base + 'right:20px;bottom:20px;align-items:flex-end;';
  }

  function render(config) {
    if (!config.enabled || !config.phoneNumber || !isAllowed(config)) return;

    var existing = document.getElementById(rootId);
    if (existing) existing.remove();

    var root = document.createElement('div');
    root.id = rootId;
    root.setAttribute('style', positionStyles(config.position));

    var button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-label', (config.behavior && config.behavior.buttonLabel) || 'Chat with us');
    var fullWidth = config.position === 'full-width-bottom';
    button.setAttribute('style', [
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'gap:10px',
      'min-height:52px',
      fullWidth ? 'width:100%' : 'max-width:min(360px,calc(100vw - 40px))',
      'border:0',
      'border-radius:999px',
      'padding:12px 16px',
      'background:' + config.color.primary,
      'color:' + config.color.text,
      'font:600 14px/1.2 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      'box-shadow:0 10px 30px rgba(0,0,0,.18)',
      'cursor:pointer'
    ].join(';'));

    var icon = document.createElement('span');
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = 'WA';
    icon.setAttribute('style', 'display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:999px;background:rgba(255,255,255,.18);font-size:11px;letter-spacing:.02em;');

    var label = document.createElement('span');
    label.textContent = (config.behavior && config.behavior.buttonLabel) || 'Chat with us';
    label.setAttribute('style', 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;');

    button.appendChild(icon);
    button.appendChild(label);

    button.addEventListener('click', function () {
      postEvent('click');
      postEvent('message');
      var text = encodeURIComponent(config.defaultMessage || 'Hello');
      var phone = String(config.phoneNumber).replace(/[^\d]/g, '');
      window.open('https://wa.me/' + phone + '?text=' + text, '_blank', 'noopener,noreferrer');
    });

    if (config.greeting && config.greeting.enabled && config.greeting.text) {
      var greeting = document.createElement('div');
      greeting.setAttribute('style', [
        'box-sizing:border-box',
        'max-width:min(320px,calc(100vw - 40px))',
        'border:1px solid rgba(0,0,0,.08)',
        'border-radius:14px',
        'padding:12px 14px',
        'background:#fff',
        'color:#111827',
        'font:500 13px/1.35 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
        'box-shadow:0 8px 24px rgba(0,0,0,.12)',
        fullWidth ? 'max-width:none' : ''
      ].join(';'));
      greeting.textContent = config.greeting.text;
      root.appendChild(greeting);
    }

    root.appendChild(button);
    document.body.appendChild(root);
    postEvent('impression');
  }

  fetch(origin + '/api/v1/widget/public/' + encodeURIComponent(widgetId) + '/config', {
    mode: 'cors',
    headers: { accept: 'application/json' }
  })
    .then(function (response) { return response.json(); })
    .then(function (payload) {
      if (!payload || !payload.success || !payload.data) return;
      var delay = Number(payload.data.behavior && payload.data.behavior.delayBeforeShow || 0);
      window.setTimeout(function () { render(payload.data); }, Math.max(0, delay) * 1000);
    })
    .catch(function () {});
})();
