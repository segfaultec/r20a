
var currentDragRow = null;
function init_drag(root, stash_root, reorder_event) {
    for (let handle of root.querySelectorAll(".r20a-draghandle"))
    {
        handle.addEventListener("dragstart", (ev) => {
    
            currentDragRow = ev.target.parentElement;
            currentDragRow.style.opacity = 0.3;
    
            ev.dataTransfer.dropEffect = "move";
        });
        handle.addEventListener("dragend", (ev) => {
            currentDragRow.style.opacity = 1.0;
    
            Array.from(root.querySelectorAll(".r20a-dragrow"))
                .sort((a,b)=>{return a.style.order - b.style.order;})
                .entries()
                .forEach(([index, row]) =>
                {
                    row.style.order = index * 2;
                });
    
            if (typeof reorder_event === "function")
            {
                reorder_event(currentDragRow, currentDragRow.style.order / 2);
            }

            currentDragRow = null;
        });
        handle.draggable = true;
    }
    
    let index = 0;
    for (let row of root.querySelectorAll(".r20a-dragrow")) {
        row.style.order = index * 2;
        row.addEventListener("dragover", (ev) => {
            ev.preventDefault();
        });
        row.addEventListener("dragenter", (ev) => {
            ev.preventDefault();
            if (currentDragRow && ev.currentTarget !== currentDragRow)
            {
                const currentOrder = currentDragRow.style.order;
                const targetOrder = ev.currentTarget.style.order;
                currentDragRow.style.order = targetOrder - Math.sign(currentOrder - targetOrder);
            }
        });
        index++;
    }

    for (let row of stash_root.querySelectorAll(".r20a-dragrow")) {
        row.addEventListener("dragover", (ev) => {
            ev.preventDefault();
        });
        row.addEventListener("dragenter", (ev) => {
            ev.preventDefault();
        });
    }
}

function on_selected_token_modified_jumper(token, new_value, event) {
    window.r20a.on_selected_token_modified(token);
}

var R20A_StatusEditor = class {
    set_status = null;
    get_status = null;
    debug_label = "?"

    constructor(setter, getter)
    {
        this.set_status = setter;
        this.get_status = getter;
    }

    static from_token(token, model_key) {
        let setter = (new_status) => {
            let payload = {}
            payload[model_key] = new_status
            token.model.save(payload)
        };
        let getter = () => {
            let status = token.model.get(model_key);
            if (status) { return status; }
            return "";
        };
        let obj = new this(setter, getter);
        obj.debug_label = token.model.get("name") + "_" + model_key;
        return obj;
    }

    add_status(statusid, message) {
        if (message) {
            message = message.replaceAll("@","").replaceAll(",","");
        }

        const old_statuses = this.get_status();

        const old_status_list = old_statuses
            .split(",")
            .map((s) => s.split("@")[0]);

        if (typeof old_status_list.find(statusid) === "undefined") {
            const new_status_entry = (message ? `${statusid}@${message}` : statusid);

            let new_statuses;
            if (old_statuses) {
                new_statuses = old_statuses + "," + new_status_entry;
            } else {
                new_statuses = new_status_entry;
            }

            this.update_token_status(new_statuses, "add");
        }
    }

    remove_status(statusid) {
        let removed_elements = []

        let new_statuses = this.get_status()
            .split(",")
            .filter((s) => {
                if (s.split("@")[0] === statusid) {
                    removed_elements.push(s);
                    return false;
                } else {
                    return true;
                }
            })
            .join(",");
        this.update_token_status(new_statuses, "remove");

        return removed_elements;
    }

    bump_numeric_status(statusid, amount) {
        let new_statuses = this.get_status()
            .split(",")
            .map((s) => {
                let split = s.split("@");
                if (split[0] === statusid && split[1]) {
                    const match = split[1].match("(-?\\d+)(ft)?");
                    if (match) {
                        let number = parseInt(match[1])
                        let bump_amount = amount;
                        // DnD height: hardcode to bump in increments of 5
                        if (match[2] === "ft") {
                            bump_amount *= 5;
                        }
                        return split[0] + "@" + split[1].replace(number, number + bump_amount);
                    }
                }
                return s;
            })
            .join(",")
        this.update_token_status(new_statuses, "bump");
    }

    edit_status(statusid, new_message) {
        if (new_message) {
            new_message = new_message.replaceAll("@","").replaceAll(",","");
        }
        let new_statuses = this.get_status()
            .split(",")
            .map((s) => {
                let split = s.split("@");
                if (split[0] === statusid) {
                    if (new_message) {
                        return split[0] + "@" + new_message;
                    } else {
                        return split[0];
                    }
                } else {
                    return s;
                }
            })
            .join(",");
        this.update_token_status( new_statuses, "edit");
    }

    reorder_status(statusid, new_index) {
        let popped_status = null;
        let new_status = Array.from(this.get_status()
            .split(",")
            .filter((value, index) => {
                if (value.split("@")[0] === statusid) {
                    popped_status = value;
                    return false;
                }
                return true;
            }));

        if (popped_status) {
            new_status.insert(popped_status, new_index);
            new_status = new_status.join(",");

            this.update_token_status(new_status, "reorder");
        }
    }

    update_token_status(new_status, op) {
        if (r20a.log) {
            const old_status = this.get_status();
            console.info(`r20a update: op:${op} token:"${this.debug_label}" old:"${old_status}" new:"${new_status}"`);
        }
        this.set_status(new_status);
    }
}

var R20A = class {
    engine = null;
    overlay = null;
    current_selected_tokens = [];
    statusicons = {};
    log = false;

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
            this.format_statusicon(element, status_id, status_value);

            element.onclick = (event) => {
                this.on_markermenu_statusicon_clicked(event.currentTarget.dataset.tag, event.currentTarget.classList.contains("active"));
            };

            markermenu.appendChild(element);

            this.statusicons[status_id].markermenu_element = element;
        }
    }

    format_statusicon(element, status_id, status_value) {
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
        if (this.skip_next_markermenu_update > 0) {
            this.skip_next_markermenu_update--;
            return;
        }

        let scrollbox = this.overlay.querySelector("details");
        let scrollbox_top = scrollbox.scrollTop;
        let scrollbox_height = scrollbox.scrollHeight;

        const row_template = document.getElementById("r20a-template-markeredit-row");
        const row_template_stash = document.getElementById("r20a-template-markeredit-stash-row");

        let markeredit = document.getElementById("r20a-markeredit");
        markeredit.innerHTML = ""

        let markeredit_stash = document.getElementById("r20a-markeredit-stash")
        markeredit_stash.innerHTML = ""

        let collect_statuses = (model_key) => {

            let statuses = {}

            for (const token of this.current_selected_tokens) {
                if (typeof token === "undefined") {
                    return;
                }

                let status = token.model.get(model_key);
                if (!status) {
                    status = ""
                }
        
                for (const s of status.split(",")) {
                    let split = s.split("@");
                    const status_id = split[0];
                    if (status_id === "") {
                        continue;
                    }
                    const status_message = split[1] ? split[1] : "";
    
                    // {token_count: 2, message_varies: false, message_numeric: false, message: "msg"};
                    if (statuses[status_id]) {
                        statuses[status_id].token_count++;
                        if (statuses[status_id].message
                            && status_message
                            && statuses[status_id].message !== status_message) {
                                statuses[status_id].message_varies = true;
                        } else if (!statuses[status_id].message && status_message) {
                            statuses[status_id].message = status_message;
                        }
                    } else {
                        statuses[status_id] = {
                            token_count: 1,
                            message: status_message,
                            message_varies: false,
                            message_numeric: false
                        };
                    }
    
                    statuses[status_id].message_numeric |= Boolean(status_message.match("\\d+"));
                }
            }

            return statuses;
        }

        let active_statuses = collect_statuses("statusmarkers");
        let stashed_statuses = collect_statuses("statusmarkers_r20a_stash")

        for (const status_id in this.statusicons) {
            if (status_id in active_statuses) {
                this.statusicons[status_id].markermenu_element.classList.add("active");
            } else {
                this.statusicons[status_id].markermenu_element.classList.remove("active");
            }
        }

        let add_row = (parent_element, active_status_id, active_status, model_key) => {

            let status_value = this.statusicons[active_status_id];

            if (typeof status_value === "undefined") {
                status_value = {
                    type: "unknown",
                    id: active_status_id,
                    name: active_status_id
                }
            }

            let row = row_template.content.cloneNode(true);

            let add_btn = row.querySelector(".r20a-btn-add");
            add_btn.onclick = (event) => {
                this.add_status(active_status_id, active_status.message, model_key);
            }
            if (this.current_selected_tokens.length == active_status.token_count) {
                add_btn.disabled = true;
            }

            let del_button = row.querySelector(".r20a-btn-remove")
            del_button.onclick = (event) => {
                this.remove_status(active_status_id, model_key);
            }

            let inc_btn = row.querySelector(".r20a-btn-inc");
            let dec_btn = row.querySelector(".r20a-btn-dec");
            inc_btn.onclick = (event) => {
                this.bump_numeric_status(active_status_id, 1, model_key)
            };
            dec_btn.onclick = (event) => {
                this.bump_numeric_status(active_status_id, -1, model_key)
            };
            if (!active_status.message_numeric) {
                inc_btn.disabled = true;
                dec_btn.disabled = true;
            }

            let input = row.querySelector(".r20a-input-message");
            if (active_status.message_varies) {
                input.value = "<varies>";
                input.onclick = (event) => {
                    if (event.currentTarget.value == "<varies>") {
                        event.currentTarget.value = "";
                    }
                }
            } else {
                input.value = active_status.message;
                input.onclick = null
            }
            input.oninput = (event) => {
                this.skip_next_markermenu_update = active_status.token_count;
                this.edit_status(active_status_id, event.target.value, model_key);

                const numeric = Boolean(event.target.value.match("\\d+"));
                inc_btn.disabled = !numeric;
                dec_btn.disabled = !numeric;
            };

            let icon = row.querySelector(".statusicon");
            let tokencount_label = row.querySelector(".r20a-status-tokencount");
            this.format_statusicon(icon, active_status_id, status_value);
            icon.classList.add("active");
            tokencount_label.innerText = `${active_status.token_count}/${this.current_selected_tokens.length}`;

            parent_element.appendChild(row);
        }

        let add_stash_row = (parent_element, active_status_id, active_status, model_key) => {
            let status_value = this.statusicons[active_status_id];

            if (typeof status_value === "undefined") {
                status_value = {
                    type: "unknown",
                    id: active_status_id,
                    name: active_status_id
                }
            }

            let row = row_template_stash.content.cloneNode(true);

            let message_element = row.querySelector(".r20a-status-stashmessage");
            if (active_status.message_varies) {
                message_element.innerText = "<varies>";
            } else {
                message_element.innerText = active_status.message;
            }

            let icon = row.querySelector(".statusicon");
            let tokencount_label = row.querySelector(".r20a-status-tokencount");
            this.format_statusicon(icon, active_status_id, status_value);
            tokencount_label.innerText = `${active_status.token_count}/${this.current_selected_tokens.length}`;

            parent_element.appendChild(row);
        }

        for (const active_status_id in active_statuses) {

            const active_status = active_statuses[active_status_id];
            
            add_row(markeredit, active_status_id, active_status, "statusmarkers");
        }

        if (Object.keys(stashed_statuses).length > 0) {
            document.getElementById("r20a-markermenu-stash-container").style.display = "block";
        } else {
            document.getElementById("r20a-markermenu-stash-container").style.display = "none";
        }

        for (const stashed_status_id in stashed_statuses) {
            const stashed_status = stashed_statuses[stashed_status_id];
            
            add_stash_row(markeredit_stash, stashed_status_id, stashed_status, "statusmarkers_r20a_stash");
        }

        init_drag(markeredit, markeredit_stash, (row_element, new_index) => {
            const status_id = row_element.querySelector(".statusicon").dataset.tag;
            this.reorder_status(status_id, new_index);
        });

        scrollbox.scrollTop = scrollbox_top + scrollbox.scrollHeight - scrollbox_height;
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