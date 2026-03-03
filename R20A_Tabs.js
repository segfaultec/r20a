
export var R20A_Tabs = class {

    tabPanels = []
    tabs = []
    ontabclicked = null

    constructor(tabsRoot, ontabclicked) {
        this.ontabclicked = ontabclicked
        this.tabPanels = Array.from(tabsRoot.querySelectorAll("[role=tabpanel]"))

        for (let idx = 0; idx < this.tabPanels.length; idx++) {
            const panel = this.tabPanels[idx]
            const tab = this.getTabForPanel(panel)
            this.tabs.push(tab)

            tab.addEventListener("click", () => {
                this.setSelectedTab(idx);
                this.ontabclicked?.(idx);
            })
        }

    }

    getTabForPanel(panel) {
        let tabid = panel.getAttribute("aria-labelledby")
        return document.getElementById(tabid)
    }

    setSelectedTab(index) {
        for (let idx = 0; idx < this.tabPanels.length; idx++) {
            const selected = idx === index;
            const panel = this.tabPanels[idx];
            if (selected) {
                panel.classList.remove("tabs-hidden")
            } else {
                panel.classList.add("tabs-hidden")
            }
            const tab = this.tabs[idx];
            tab.setAttribute("aria-selected", selected ? "true" : false)
        }
    }

}