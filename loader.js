
if (typeof browser === "undefined") {
    var browser = chrome;
}

var startup = () => {
    console.log("loader");

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
            l.href = browser.runtime.getURL("markermenu.css");
            document.head.appendChild(l);

            var s = document.createElement("script");
            s.id = "r20a-markermenu-script";
            s.src = browser.runtime.getURL("markermenu.js");
            document.head.appendChild(s);
        });
}

if (document.readyState === 'complete')
{
    startup();
}   
else
{
    window.addEventListener("load", startup);
}
