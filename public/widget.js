(function () {
  if (window.__aiWidgetLoaded) return;
  window.__aiWidgetLoaded = true;

  var DOMAIN = 'https://avatar-rtl-widget-2.vercel.app';
  var SRC = DOMAIN + '/embed';

  function onReady(fn) {
    if (document.readyState === 'loading') {
      window.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  onReady(function () {
    // Strong overrides for WP/Kadence global rules that break iframes
    var css = `
#aiw-launcher{
  position:fixed;
  right:calc(16px + env(safe-area-inset-right));
  bottom:calc(16px + env(safe-area-inset-bottom));
  z-index:2147483000;
  width:58px; height:58px; border-radius:50%;
  background:#0a84ff; color:#fff;
  display:flex; align-items:center; justify-content:center;
  box-shadow:0 8px 24px rgba(0,0,0,.35);
  cursor:pointer; user-select:none;
}
#aiw-launcher:hover{ filter:brightness(1.05) }

/* Panel: lock dimensions + fix positioning */
#aiw-wrap{
  position:fixed !important;
  right:calc(16px + env(safe-area-inset-right)) !important;
  bottom:calc(86px + env(safe-area-inset-bottom)) !important;
  z-index:2147482999 !important;
  width:380px !important; height:560px !important;
  display:none !important;
  box-shadow:0 14px 40px rgba(0,0,0,.45) !important;
  border-radius:14px !important; overflow:hidden !important;
  background:#000 !important;
  transform:none !important;  /* defeat any theme transforms */
}

/* The iframe MUST fill the panel regardless of theme defaults */
#aiw-iframe{
  position:absolute !important;
  inset:0 !important;
  border:0 !important;
  width:100% !important;
  height:100% !important;
  min-height:100% !important;
  max-height:100% !important;
  display:block !important;
  background:#000 !important;
  aspect-ratio:auto !important;
  pointer-events:auto !important;
}

/* Override very opinionated global rules some themes inject */
iframe#aiw-iframe, div#aiw-wrap iframe#aiw-iframe{
  height:100% !important;
  max-width:none !important;
}

/* Mobile: responsive but still portrait-ish */
@media (max-width: 480px){
  #aiw-wrap{
    width:92vw !important; height:72vh !important;
    right:8px !important; bottom:82px !important;
    border-radius:12px !important;
  }
  #aiw-launcher{ right:8px !important; bottom:8px !important; width:54px !important; height:54px !important; }
}
`;
    var style = document.createElement('style');
    style.appendChild(document.createTextNode(css));
    document.head.appendChild(style);

    // Launcher bubble
    var launcher = document.createElement('div');
    launcher.id = 'aiw-launcher';
    launcher.setAttribute('aria-label','Open assistant');
    launcher.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M4 5.5A3.5 3.5 0 0 1 7.5 2h9A3.5 3.5 0 0 1 20 5.5v6A3.5 3.5 0 0 1 16.5 15H12l-4.5 4v-4H7.5A3.5 3.5 0 0 1 4 11.5v-6Z" fill="white"/></svg>';
    document.body.appendChild(launcher);

    // Panel with ONLY the iframe (controls are inside the iframe UI)
    var wrap = document.createElement('div');
    wrap.id = 'aiw-wrap';

    var iframe = document.createElement('iframe');
    iframe.id = 'aiw-iframe';
    iframe.src = SRC;
    iframe.allow = 'microphone; autoplay; camera; fullscreen; display-capture; clipboard-read; clipboard-write';
    iframe.referrerPolicy = 'no-referrer-when-downgrade';
    // inline style as a second line of defense
    iframe.style.cssText = 'position:absolute;inset:0;border:0;width:100%;height:100%;display:block;background:#000;';
    wrap.appendChild(iframe);
    document.body.appendChild(wrap);

    var open = false;
    function show(){ wrap.style.display='block'; open = true; }
    function hide(){ wrap.style.display='none'; open = false; }

    launcher.addEventListener('click', function(){ open ? hide() : show(); });

    // Optional: close on ESC
    window.addEventListener('keydown', function(e){ if(e.key==='Escape' && open) hide(); });

    // Optional: auto-open once after load
    // setTimeout(show, 2200);
  });
})();
