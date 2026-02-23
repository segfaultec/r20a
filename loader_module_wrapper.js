async function main() {
    if (typeof browser === "undefined") {
        var browser = chrome;
    }

    const loader = await import(browser.runtime.getURL("./loader.js"))
}

main();