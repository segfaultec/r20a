"use strict";

import { format_statusicon } from "./utils.js";
import { R20A_Markermenu } from "./R20A_Markermenu.js";
import { R20A_StatusEditor } from "./R20A_StatusEditor.js";
import { R20A_SettingsManager } from "./R20A_SettingsManager.js";
import { DragPositioningHandler } from "./dragging.js";
import { R20A_Tabs } from "./R20A_Tabs.js";

function on_selected_token_modified_jumper(token, new_value, event) {
    window.r20a.on_selected_token_modified(token);
}

function sendContentScriptMessage(payload) {
    window.postMessage({
        extension: "r20a",
        direction: "page-to-content",
        payload: payload
    });
}

var R20A = class {
    engine = null;
    overlay = null;
    current_selected_tokens = [];
    statusicons = {};
    log = false;
    markermenu = null;
    scrollbox = null;
    overlay_dragpositioning = null
    overlay_detailspanel = null
    tabsmanager = null

    constructor(engine) {

        this.engine = engine
        this.overlay = document.getElementById("r20a-overlay");

        const r20a_this = this;

        ["clearSelection","addToSelection","removeFromSelection"].forEach(func => {
            var old = engine.tabletop[func];
            engine.tabletop[func] = function(...args) {
                var ret = old.apply(this, args);
                r20a_this.on_selection_updated();
                return ret;
            }
        });

        const token_editor = this.engine.page.d20.token_editor
        for (const color_key in token_editor.colorMarkers) {
            const color_value = token_editor.colorMarkers[color_key];

            this.statusicons[color_key] = {type: "color", color: color_value, name: color_key};
        }
        this.statusicons["dead"] = {type: "dead", name: "dead"};
        for (const token of token_marker_array) {
            this.statusicons[token.tag] = {type: "token", url: token.url, name: token.name};
        }

        let markermenu = document.getElementById("r20a-markermenu");
        for (const status_id in this.statusicons) {
            const status_value = this.statusicons[status_id];

            let element = document.createElement("div");
            format_statusicon(element, status_id, status_value);

            element.onclick = (event) => {
                this.on_markermenu_statusicon_clicked(event.currentTarget.dataset.tag, event.currentTarget.classList.contains("active"));
            };

            markermenu.appendChild(element);

            this.statusicons[status_id].markermenu_element = element;
        }

        this.markermenu = new R20A_Markermenu(this, this.overlay);

        this.scrollbox = this.overlay.querySelector("#r20a-scrollbox")
        this.scrollbox.addEventListener("mouseup", this.save_scrollbox_height.bind(this))

        let tabsRoot = this.overlay.querySelector(".r20a-tabs")
        if (tabsRoot) {
            this.tabsmanager = new R20A_Tabs(tabsRoot, this.save_tabs_index.bind(this));
        }

        window.addEventListener(R20A_SettingsManager.LoadedEventName, (event) => {
            window.r20a_settings = new R20A_SettingsManager()
            window.r20a_settings.deserialize(event.detail)
            this.on_settings_loaded(window.r20a_settings)
        })
        if (window.r20a_settings !== undefined) {
            this.on_settings_loaded(window.r20a_settings)
        } else {
            sendContentScriptMessage({"type":"get_settings"});
        }

        const draghandle = this.overlay.querySelector("#r20a-overlay-drag-grip")
        this.overlay_dragpositioning = new DragPositioningHandler(this.overlay, draghandle, this.save_overlay_position.bind(this))

        this.overlay_detailspanel = this.overlay.querySelector("details")

        const togglebutton = this.overlay.querySelector("#r20a-overlay-togglebutton")
        togglebutton.addEventListener("click", (event) => {
            this.set_detailspanel_open(!this.overlay_detailspanel.open, true);
        })
    }

    get_label(suffix) {
        return document.getElementById("r20a-label-" + suffix);
    }

    show_token_editor(tokens) {
        this.overlay.style.display = "block";

        let tokenstr;
        if (tokens.length != 1) {
            tokenstr = `${tokens.length} tokens selected`
        } else {
            tokenstr = `${tokens[0].model.get("name")} selected`
        }
        this.get_label("tokencount").innerText = tokenstr;
    }

    hide_token_editor() {
        this.overlay.style.display = "none";
    }

    update_token_editor_markermenu() {
        this.markermenu.update(this.current_selected_tokens);
    }

    on_selected_token_modified(token) {
        this.update_token_editor_markermenu();
    }

    on_markermenu_statusicon_clicked(status_id, is_active) {
        if (is_active) {
            this.remove_status(status_id);
        } else {
            this.add_status(status_id, "");
        }   
    }

    on_selection_updated() {

        let selection = this.engine.tabletop.getSelection();
        let selected_tokens = selection.filter((x) => x.type === "Token");

        this.current_selected_tokens.forEach((old_token) => {
            old_token.model.unbind("change:name", on_selected_token_modified_jumper)
            old_token.model.unbind("change:statusmarkers", on_selected_token_modified_jumper)
        });

        if (selected_tokens.length > 0)
        {
            this.current_selected_tokens = selected_tokens;

            this.show_token_editor(selected_tokens);
            this.update_token_editor_markermenu();
        }
        else if (selected_tokens.length == 0)
        {
            this.current_selected_tokens = []
            this.hide_token_editor();
        }

        this.current_selected_tokens.forEach((new_token) => {
            new_token.model.bind("change:name", on_selected_token_modified_jumper);
            new_token.model.bind("change:statusmarkers", on_selected_token_modified_jumper);
        });
    }

    add_status(statusid, message, model_key = "statusmarkers") {
        if (message) {
            message = message.replaceAll("@","").replaceAll(",","");
        }
        this.current_selected_tokens.forEach((token) => {
            R20A_StatusEditor.from_token(token, model_key).add_status(statusid, message);
        });
    }

    remove_status(statusid, model_key = "statusmarkers") {
        this.current_selected_tokens.forEach((token) => {
            R20A_StatusEditor.from_token(token, model_key).remove_status(statusid);
        });
    }

    bump_numeric_status(statusid, amount, model_key = "statusmarkers") {
        this.current_selected_tokens.forEach((token) => {
            R20A_StatusEditor.from_token(token, model_key).bump_numeric_status(statusid, amount);
        });
    }

    edit_status(statusid, new_message, model_key = "statusmarkers") {
        this.current_selected_tokens.forEach((token) => {
            R20A_StatusEditor.from_token(token, model_key).edit_status(statusid, new_message);
        });
    }

    reorder_status(statusid, new_index, model_key = "statusmarkers") {
        this.current_selected_tokens.forEach((token) => {
            R20A_StatusEditor.from_token(token, model_key).reorder_status(statusid, new_index);
        });
    }

    on_settings_loaded(settings) {
        if (this.scrollbox)
        {
            this.scrollbox.style.height = `${settings.scrollbox_height}px`
        }
        if (this.overlay_detailspanel)
        {
            this.set_detailspanel_open(settings.overlay_open, false)
        }
        this.overlay_dragpositioning?.apply_position([settings.overlay_x, settings.overlay_y])
        
        this.tabsmanager?.setSelectedTab(settings.tab_index);
    }

    save_scrollbox_height() {

        const height_px = window.r20a.scrollbox.style.height
        const height = parseFloat(height_px)

        if (height == window.r20a_settings.scrollbox_height) {
            return;
        }

        window.r20a_settings.scrollbox_height = height
        this.save_settings()
    }

    save_overlay_position(position) {
        const x = position[0]
        const y = position[1]
        if (x == window.r20a_settings.overlay_x
            && y == window.r20a_settings.overlay_y
        ) {
            return;
        }

        window.r20a_settings.overlay_x = x;
        window.r20a_settings.overlay_y = y;
        this.save_settings();
    }

    save_tabs_index(index) {
        if (index == window.r20a_settings.tab_index) {
            return;
        }

        window.r20a_settings.tab_index = index;
        this.save_settings();
    }

    set_detailspanel_open(open, savesettings) {
        if (open) {
            this.overlay_detailspanel.open = true;
        } else {
            this.overlay_detailspanel.removeAttribute("open");
        }

        if (savesettings) {
            window.r20a_settings.overlay_open = open;
            this.save_settings();
        }
    }

    save_settings() {
        sendContentScriptMessage({type:"set_settings", settings: window.r20a_settings.serialize()})
    }
}

function wait_for_init() {
    if (window.Campaign?.engine?.page?.d20?.token_editor && token_marker_array)
    {
        init();
    }
    else
    {
        setTimeout(wait_for_init, 100);
    }
}

function init() {

    window.r20a = new R20A(window.Campaign.engine)

    console.info("r20a init!")
}

wait_for_init();