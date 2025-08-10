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
    // Styles for launcher + panel (responsive, bottom-right)
    var css = `
#aiw-launcher{
  position:fixed; right:calc(16px + env(safe-area-inset-right));
  bottom:calc(16px + env(safe-area-inset-bottom));
  z-index:2147483000; width:58px; height:58px; border-radius:50%;
  background:#0a84ff; color:#fff; display:flex; align-items:center; justify-content:center;
  box-shadow:0 8px 24px rgba(0,0,0,.35); cursor:pointer; user-select:none
}
#aiw-launcher:hover{ filter:brightness(1.05) }
#aiw-wrap{
  position:fixed; right:calc(16px + env(safe-area-inset-right));
  bottom:calc(86px + env(safe-area-inset-bottom));
  z-index:2147482999; width:380px; height:560px; display:none;
  box-shadow:0 14px 40px rgba(0,0,0,.45); border-radius:14px; overflow:hidden; background:#000
}
#aiw-iframe{ position:absolute; inset:0; border:0; width:100%; height:100% }
@media (max-width: 480px){
  #aiw-wrap{ width:92vw; height:70vh; right:8px; bottom:82px; border-radius:12px }
  #aiw-launcher{ right:8px; bottom:8px; width:54px; height:54px }
}`;
    var style = document.createElement('style');
    style.appendChild(document.createTextNode(css));
    document.head.appendChild(style);

    // Launcher bubble
    var launcher = document.createElement('div');
    launcher.id = 'aiw-launcher';
    launcher.setAttribute('aria-label','Open assistant');
    launcher.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M4 5.5A3.5 3.5 0 0 1 7.5 2h9A3.5 3.5 0 0 1 20 5.5v6A3.5 3.5 0 0 1 16.5 15H12l-4.5 4v-4H7.5A3.5 3.5 0 0 1 4 11.5v-6Z" fill="white"/></svg>';
    document.body.appendChild(launcher);

    // Panel with only the iframe (all controls live inside the iframe UI)
    var wrap = document.createElement('div');
    wrap.id = 'aiw-wrap';

    var iframe = document.createElement('iframe');
    iframe.id = 'aiw-iframe';
    iframe.src = SRC;
    iframe.allow = 'microphone; autoplay; camera; fullscreen; display-capture; clipboard-read; clipboard-write';
    iframe.referrerPolicy = 'no-referrer-when-downgrade';
    wrap.appendChild(iframe);
    document.body.appendChild(wrap);

    var open = false;
    function show(){ wrap.style.display='block'; open = true; }
    function hide(){ wrap.style.display='none'; open = false; }

    launcher.addEventListener('click', function(){ open ? hide() : show(); });

    // Optional: close on ESC
    window.addEventListener('keydown', function(e){ if(e.key==='Escape' && open) hide(); });

    // Optional: auto-open once on first visit after load
    // setTimeout(show, 2200);
  });
})();
