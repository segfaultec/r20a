import { R20A_SettingsManager } from "./R20A_SettingsManager.js";

if (typeof browser === "undefined") {
    var browser = chrome;
}

var receiveMessage = (event) => {
    if (event.source === window
        && event.data.extension === "r20a"
        && event.data.direction === "page-to-content")
    {
        if (event.data.payload.type === "set_settings")
        {
            let newsettings = new R20A_SettingsManager()
            if (newsettings.deserialize(event.data.payload.settings))
            {
                window.r20a_settings = newsettings
                window.r20a_settings.saveToStorage()
            }
        }
        else if (event.data.payload.type === "get_settings")
        {
            window.r20a_settings.sendLoadedEvent();
        }
    }
}

var startup = () => {
    console.log("r20a loader");

    window.addEventListener("message", receiveMessage);

    document.getElementById("r20a-markermenu-css")?.remove();
    document.getElementById("r20a-markermenu-script")?.remove();
    document.getElementById("r20a-overlay")?.remove();

    fetch(browser.runtime.getURL("markermenu.html"))
        .then((r) => r.text())
        .then((html) => {
            document.body.insertAdjacentHTML("beforeend", html);

            var l = document.createElement("link");
            l.id = "r20a-markermenu-css"
            l.rel = "stylesheet";
            l.type = "text/css"
            l.href = browser.runtime.getURL("markermenu.css") + "?w=" + Date.now();
            document.head.appendChild(l);

            var s = document.createElement("script");
            s.id = "r20a-markermenu-script";
            s.src = browser.runtime.getURL("markermenu.js") + "?w=" + Date.now();
            s.type = "module"
            document.head.appendChild(s);
        });

    R20A_SettingsManager.loadFromStorage()
}

if (document.readyState === 'complete')
{
    startup();
}   
else
{
    window.addEventListener("load", startup);
}
