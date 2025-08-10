(function () {
  function createAssistantWidget() {
    const widgetButton = document.createElement("div");
    widgetButton.id = "assistant-widget-button";
    widgetButton.style.position = "fixed";
    widgetButton.style.bottom = "20px";
    widgetButton.style.right = "20px";
    widgetButton.style.width = "60px";
    widgetButton.style.height = "60px";
    widgetButton.style.background = "#0073ff";
    widgetButton.style.borderRadius = "50%";
    widgetButton.style.cursor = "pointer";
    widgetButton.style.boxShadow = "0px 4px 12px rgba(0,0,0,0.3)";
    widgetButton.style.zIndex = "999999";
    widgetButton.innerHTML = '<span style="color:white;font-size:28px;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%)">&#128172;</span>';

    const iframeContainer = document.createElement("div");
    iframeContainer.id = "assistant-widget-iframe-container";
    iframeContainer.style.position = "fixed";
    iframeContainer.style.bottom = "90px";
    iframeContainer.style.right = "20px";
    iframeContainer.style.width = "400px";
    iframeContainer.style.height = "600px";
    iframeContainer.style.background = "white";
    iframeContainer.style.borderRadius = "10px";
    iframeContainer.style.boxShadow = "0px 4px 12px rgba(0,0,0,0.3)";
    iframeContainer.style.overflow = "hidden";
    iframeContainer.style.display = "none";
    iframeContainer.style.zIndex = "999999";

    const iframe = document.createElement("iframe");
    iframe.src = "https://avatar-rtl-widget-2.vercel.app/embed";
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "none";

    iframeContainer.appendChild(iframe);

    document.body.appendChild(widgetButton);
    document.body.appendChild(iframeContainer);

    widgetButton.addEventListener("click", function () {
      iframeContainer.style.display =
        iframeContainer.style.display === "none" ? "block" : "none";
    });
  }

  window.addEventListener("load", createAssistantWidget);
})();
