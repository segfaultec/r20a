
function on_selected_token_modified_jumper(token, new_value, event) {
    window.r20a.on_selected_token_modified(token);
}

var R20A = class {
    engine = null
    overlay = null
    current_selected_tokens = []
    statusicons = {};

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
        let markeredit = document.getElementById("r20a-markeredit");
        markeredit.innerHTML = ""

        const active_statuses = {};

        for (const token of this.current_selected_tokens) {
            if (typeof token === "undefined") {
                return;
            }
    
            for (const s of token.model.get("statusmarkers").split(",")) {
                let split = s.split("@");
                const status_id = split[0];
                if (status_id === "") {
                    continue;
                }
                const status_message = split[1] ? split[1] : "";

                // {token_count: 2, message_varies: false, message_numeric: false, message: "msg"};
                if (active_statuses[status_id]) {
                    active_statuses[status_id].token_count++;
                    if (active_statuses[status_id].message
                        && status_message
                        && active_statuses[status_id].message !== status_message) {
                        active_statuses[status_id].message_varies = true;
                    } else if (!active_statuses[status_id].message && status_message) {
                        active_statuses[status_id].message = status_message;
                    }
                } else {
                    active_statuses[status_id] = {
                        token_count: 1,
                        message: status_message,
                        message_varies: false,
                        message_numeric: false
                    };
                }

                active_statuses[status_id].message_numeric |= Boolean(status_message.match("\\d+"));
            }
        }

        for (const status_id in this.statusicons) {
            if (status_id in active_statuses) {
                this.statusicons[status_id].markermenu_element.classList.add("active");
            } else {
                this.statusicons[status_id].markermenu_element.classList.remove("active");
            }
        }

        for (const active_status_id in active_statuses) {

            const active_status = active_statuses[active_status_id];
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
                this.add_status(active_status_id, active_status.message);
            }
            if (this.current_selected_tokens.length == active_status.token_count) {
                add_btn.disabled = true;
            }

            let del_button = row.querySelector(".r20a-btn-remove")
            del_button.onclick = (event) => {
                this.remove_status(active_status_id);
            }

            let inc_btn = row.querySelector(".r20a-btn-inc");
            let dec_btn = row.querySelector(".r20a-btn-dec");
            inc_btn.onclick = (event) => {
                this.bump_numeric_status(active_status_id, 1)
            };
            dec_btn.onclick = (event) => {
                this.bump_numeric_status(active_status_id, -1)
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
            input.onkeyup = (event) => {
                this.skip_next_markermenu_update = active_status.token_count;
                this.edit_status(active_status_id, event.target.value);

                const numeric = Boolean(event.target.value.match("\\d+"));
                inc_btn.disabled = !numeric;
                dec_btn.disabled = !numeric;
            };

            let icon = row.querySelector(".statusicon");
            let tokencount_label = row.querySelector(".r20a-status-tokencount");
            this.format_statusicon(icon, active_status_id, status_value);
            icon.classList.add("active");
            tokencount_label.innerText = `${active_status.token_count}/${this.current_selected_tokens.length}`;

            markeredit.appendChild(row);
        }

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
        });
    }

    add_status(statusid, message) {
        if (message) {
            message = message.replaceAll("@","").replaceAll(",","");
        }
        this.current_selected_tokens.forEach((token) => {
            let old_statuses = token.model.get("statusmarkers")
                .split(",")
                .map((s) => s.split("@")[0]);

            if (typeof old_statuses.find(statusid) === "undefined") {
                let new_statuses = old_statuses
                    + ","
                    + (message ? `${statusid}@${message}` : statusid);
                    token.model.save({statusmarkers:new_statuses});
            }
        });
    }

    remove_status(statusid) {
        this.current_selected_tokens.forEach((token) => {
            let new_statuses = token.model.get("statusmarkers")
                .split(",")
                .filter((s) => s.split("@")[0] !== statusid)
                .join(",");
            token.model.save({statusmarkers:new_statuses});
        });
    }

    bump_numeric_status(statusid, amount) {
        this.current_selected_tokens.forEach((token) => {
            let new_statuses = token.model.get("statusmarkers")
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
            token.model.save({statusmarkers:new_statuses});
        });
    }

    edit_status(statusid, new_message) {
        if (new_message) {
            new_message = new_message.replaceAll("@","").replaceAll(",","");
        }
        this.current_selected_tokens.forEach((token) => {
            let new_statuses = token.model.get("statusmarkers")
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
            token.model.save({statusmarkers:new_statuses});
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

    console.log("init!")
}

wait_for_init();