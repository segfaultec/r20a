import { R20A_Markermenu } from "./R20A_Markermenu.js";
import { R20A_StatusEditor } from "./R20A_StatusEditor.js";

function on_selected_token_modified_jumper(token, new_value, event) {
    window.r20a.on_selected_token_modified(token);
}

export function format_statusicon(element, status_id, status_value) {
    element.classList.add("statusicon");
    element.title = status_value.name;
    element.dataset.tag = status_id;
    if (status_value.type === "token") {
        element.classList.add("markericon");
        element.style.backgroundImage = `url(${status_value.url})`;
    } else if (status_value.type === "color") {
        element.classList.add("markercolor");
        element.style.backgroundColor = status_value.color;
    } else if (status_value.type === "dead") {
        element.classList.add("markercolor");
        element.classList.add("dead");
        element.innerText = "X";
    } else if (status_value.type === "unknown") {
        element.classList.add("markercolor");
        element.classList.add("dead");
        element.innerText = "?";
    } else {
        console.warn("unknown status type " + status_value.type);
    }
}

var R20A = class {
    engine = null;
    overlay = null;
    current_selected_tokens = [];
    statusicons = {};
    log = false;
    markermenu = null;

    // flag so we don't rerender the markermenu when typing in the edit textbox
    // gets incremented once for each token, so it decrements back to 0 when each token gets modified
    skip_next_markermenu_update = 0;

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
    }

    get_label(suffix) {
        return document.getElementById("r20a-label-" + suffix);
    }

    show_token_editor(screen_x, screen_y, tokens) {
        this.overlay.style.display = "block";
        this.overlay.style.left = `${screen_x}px`;
        this.overlay.style.top = `${screen_y}px`;

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
            old_token.model.unbind("change:statusmarkers_r20a_stash", on_selected_token_modified_jumper)
        });

        if (selected_tokens.length > 0)
        {
            this.current_selected_tokens = selected_tokens;

            var average_screen_pos_x = 70.0;
            var average_screen_pos_y = 90.0;
            this.show_token_editor(average_screen_pos_x, average_screen_pos_y, selected_tokens);
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
            new_token.model.bind("change:statusmarkers_r20a_stash", on_selected_token_modified_jumper);
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

    stash_status(statusid) {
        this.current_selected_tokens.forEach((token) => {
            let removed = R20A_StatusEditor.from_token(token, "statusmarkers").remove_status(statusid);
            removed.forEach((s) => {
                let s_split = s.split("@");
                R20A_StatusEditor.from_token(token, "statusmarkers_r20a_stash").add_status(s_split[0], s_split[1]);
            })
        });
    }

    unstash_status(statusid) {
        this.current_selected_tokens.forEach((token) => {
            let removed = R20A_StatusEditor.from_token(token, "statusmarkers_r20a_stash").remove_status(statusid);
            removed.forEach((s) => {
                let s_split = s.split("@");
                R20A_StatusEditor.from_token(token, "statusmarkers").add_status(s_split[0], s_split[1]);
            })
        });
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