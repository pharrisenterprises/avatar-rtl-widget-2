(function () {
  if (window.__aiWidgetLoaded) return;
  window.__aiWidgetLoaded = true;

  var DOMAIN = 'https://avatar-rtl-widget-2.vercel.app'; // your live deploy
  var SRC = DOMAIN + '/embed';

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  ready(function () {
    // ----- styles
    var css = `
#ai-widget-launcher {
  position: fixed; right: 18px; bottom: 18px; z-index: 999999;
  width: 56px; height: 56px; border-radius: 50%;
  background: #111; color: #fff; display: flex; align-items: center; justify-content: center;
  box-shadow: 0 6px 24px rgba(0,0,0,0.35); cursor: pointer; user-select: none;
  font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
}
#ai-widget-launcher:hover { background: #1a1a1a; }
#ai-widget-frame-wrap {
  position: fixed; right: 18px; bottom: 82px; z-index: 999998;
  width: 380px; height: 600px; display: none;
  box-shadow: 0 10px 30px rgba(0,0,0,0.45);
  border-radius: 12px; overflow: hidden; background: #0b0b0b;
}
#ai-widget-topbar {
  position: absolute; top: 0; left: 0; right: 0; height: 36px; background: #0f0f0f;
  display: flex; align-items: center; justify-content: space-between; padding: 0 10px; color: #fff; font-size: 14px;
}
#ai-widget-iframe {
  position: absolute; top: 36px; left: 0; right: 0; bottom: 0; width: 100%; height: calc(100% - 36px); border: 0;
}
@media (max-width: 480px) {
  #ai-widget-frame-wrap { right: 8px; bottom: 82px; width: 92vw; height: 70vh; }
  #ai-widget-launcher { right: 8px; bottom: 8px; }
}
    `;
    var style = document.createElement('style');
    style.setAttribute('data-ai-widget', '1');
    style.appendChild(document.createTextNode(css));
    document.head.appendChild(style);

    // ----- launcher
    var launcher = document.createElement('div');
    launcher.id = 'ai-widget-launcher';
    launcher.setAttribute('aria-label', 'Open assistant');
    launcher.innerHTML = '💬';
    document.body.appendChild(launcher);

    // ----- panel + iframe
    var panel = document.createElement('div');
    panel.id = 'ai-widget-frame-wrap';
    panel.innerHTML =
      '<div id="ai-widget-topbar"><div>Assistant</div>' +
      '<button id="ai-widget-close" style="background:#222;color:#fff;border:0;border-radius:6px;padding:6px 8px;cursor:pointer;">Minimize</button></div>' +
      '<iframe id="ai-widget-iframe" allow="microphone; autoplay; camera; fullscreen; display-capture; clipboard-read; clipboard-write" referrerpolicy="no-referrer-when-downgrade"></iframe>';
    document.body.appendChild(panel);

    var iframe = panel.querySelector('#ai-widget-iframe');
    iframe.src = SRC;

    var open = false;
    function showPanel() { panel.style.display = 'block'; open = true; }
    function hidePanel() { panel.style.display = 'none';  open = false; }

    launcher.addEventListener('click', function () { open ? hidePanel() : showPanel(); });
    panel.querySelector('#ai-widget-close').addEventListener('click', hidePanel);
  });
})();
