(function () {
  if (window.__aiWidgetLoaded) return;
  window.__aiWidgetLoaded = true;

  var DOMAIN = 'https://avatar-rtl-widget-2.vercel.app'; // keep Vercel domain here
  var SRC = DOMAIN + '/embed';

  function ready(fn){ document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', fn) : fn(); }

  ready(function () {
    var css = `
#aiw-launcher{position:fixed;right:18px;bottom:18px;z-index:999999;width:56px;height:56px;border-radius:50%;
background:#111;color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 24px rgba(0,0,0,.35);cursor:pointer;user-select:none}
#aiw-launcher:hover{background:#1a1a1a}
#aiw-wrap{position:fixed;right:18px;bottom:82px;z-index:999998;width:420px;height:720px;display:none;box-shadow:0 10px 30px rgba(0,0,0,.45);border-radius:14px;overflow:hidden;background:#000}
#aiw-top{position:absolute;left:0;right:0;top:0;height:38px;background:rgba(0,0,0,.65);display:flex;align-items:center;justify-content:space-between;padding:0 10px;color:#fff}
#aiw-iframe{position:absolute;top:38px;left:0;right:0;bottom:0;width:100%;height:calc(100% - 38px);border:0}
@media(max-width:480px){#aiw-wrap{right:8px;bottom:82px;width:92vw;height:72vh}#aiw-launcher{right:8px;bottom:8px}}
`;
    var style = document.createElement('style'); style.appendChild(document.createTextNode(css)); document.head.appendChild(style);

    var launcher = document.createElement('div');
    launcher.id = 'aiw-launcher';
    launcher.setAttribute('aria-label','Open assistant');
    launcher.innerHTML = '💬';
    document.body.appendChild(launcher);

    var wrap = document.createElement('div');
    wrap.id = 'aiw-wrap';
    wrap.innerHTML = '<div id="aiw-top"><div>Assistant</div><div><button id="aiw-min" style="background:#222;color:#fff;border:0;border-radius:6px;padding:6px 8px;cursor:pointer;">Minimize</button></div></div><iframe id="aiw-iframe" allow="microphone; autoplay; camera; fullscreen; display-capture; clipboard-read; clipboard-write" referrerpolicy="no-referrer-when-downgrade"></iframe>';
    document.body.appendChild(wrap);

    var iframe = wrap.querySelector('#aiw-iframe');
    iframe.src = SRC;

    var open=false;
    function show(){wrap.style.display='block';open=true;}
    function hide(){wrap.style.display='none';open=false;}

    launcher.addEventListener('click', function(){open?hide():show();});
    wrap.querySelector('#aiw-min').addEventListener('click', hide);
  });
})();
