import { format_statusicon } from "./markermenu.js";
import { init_drag } from "./dragging.js";

export var R20A_Markermenu = class {

    constructor(controller, overlay) {

        this.controller = controller;
        this.scrollbox = overlay.querySelector("details");
        this.row_template = document.getElementById("r20a-template-markeredit-row");
        this.row_template_stash = document.getElementById("r20a-template-markeredit-stash-row");

        this.markeredit = document.getElementById("r20a-markeredit");
        this.markeredit_stash = document.getElementById("r20a-markeredit-stash");

        this.skip_next_markermenu_update = 0;
    }

    collect_statuses(tokens, model_key) {

        let statuses = {};

        for (const token of tokens) {
            if (typeof token === "undefined") {
                return;
            }

            let status = token.model.get(model_key);
            if (!status) {
                status = "";
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

    add_row(active_status_id, active_status, total_count) {

        let status_value = this.controller.statusicons[active_status_id];

        if (typeof status_value === "undefined") {
            status_value = {
                type: "unknown",
                id: active_status_id,
                name: active_status_id
            };
        }

        let row = this.row_template.content.cloneNode(true);

        let add_btn = row.querySelector(".r20a-btn-add");
        add_btn.onclick = (event) => {
            this.controller.add_status(active_status_id, active_status.message, "statusmarkers");
        };
        if (total_count == active_status.token_count) {
            add_btn.disabled = true;
        }

        let del_button = row.querySelector(".r20a-btn-remove");
        del_button.onclick = (event) => {
            this.controller.remove_status(active_status_id, "statusmarkers");
        };

        let inc_btn = row.querySelector(".r20a-btn-inc");
        let dec_btn = row.querySelector(".r20a-btn-dec");
        inc_btn.onclick = (event) => {
            this.controller.bump_numeric_status(active_status_id, 1, "statusmarkers");
        };
        dec_btn.onclick = (event) => {
            this.controller.bump_numeric_status(active_status_id, -1, "statusmarkers");
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
            };
        } else {
            input.value = active_status.message;
            input.onclick = null;
        }
        input.oninput = (event) => {
            this.skip_next_markermenu_update = active_status.token_count;
            this.controller.edit_status(active_status_id, event.target.value, "statusmarkers");

            const numeric = Boolean(event.target.value.match("\\d+"));
            inc_btn.disabled = !numeric;
            dec_btn.disabled = !numeric;
        };

        let icon = row.querySelector(".statusicon");
        let tokencount_label = row.querySelector(".r20a-status-tokencount");
        format_statusicon(icon, active_status_id, status_value);
        icon.classList.add("active");
        tokencount_label.innerText = `${active_status.token_count}/${total_count}`;

        this.markeredit.appendChild(row);
    }

    add_stash_row(active_status_id, active_status, total_count) {
        let status_value = this.controller.statusicons[active_status_id];

        if (typeof status_value === "undefined") {
            status_value = {
                type: "unknown",
                id: active_status_id,
                name: active_status_id
            };
        }

        let row = this.row_template_stash.content.cloneNode(true);

        let message_element = row.querySelector(".r20a-status-stashmessage");
        if (active_status.message_varies) {
            message_element.innerText = "<varies>";
        } else {
            message_element.innerText = active_status.message;
        }

        let icon = row.querySelector(".statusicon");
        let tokencount_label = row.querySelector(".r20a-status-tokencount");
        format_statusicon(icon, active_status_id, status_value);
        tokencount_label.innerText = `${active_status.token_count}/${total_count}`;

        this.markeredit_stash.appendChild(row);
    }

    save_scrollbox() {
        this.scrollbox_top = this.scrollbox.scrollTop;
        this.scrollbox_height = this.scrollbox.scrollHeight;
    }

    restore_scrollbox() {
        this.scrollbox.scrollTop = this.scrollbox_top + this.scrollbox.scrollHeight - this.scrollbox_height;
    }

    update(current_selected_tokens) {
        if (this.skip_next_markermenu_update > 0) {
            this.skip_next_markermenu_update--;
            return;
        }

        this.save_scrollbox();

        this.markeredit.innerHTML = "";
        this.markeredit_stash.innerHTML = "";

        let active_statuses = this.collect_statuses(current_selected_tokens, "statusmarkers");
        let stashed_statuses = this.collect_statuses(current_selected_tokens, "statusmarkers_r20a_stash");

        // this is ugly, replace
        for (const status_id in this.controller.statusicons) {
            if (status_id in active_statuses) {
                this.controller.statusicons[status_id].markermenu_element.classList.add("active");
            } else {
                this.controller.statusicons[status_id].markermenu_element.classList.remove("active");
            }
        }

        for (const active_status_id in active_statuses) {

            const active_status = active_statuses[active_status_id];

            this.add_row(active_status_id, active_status, current_selected_tokens.length);
        }

        // todo use class with query
        if (Object.keys(stashed_statuses).length > 0) {
            document.getElementById("r20a-markermenu-stash-container").style.display = "block";
        } else {
            document.getElementById("r20a-markermenu-stash-container").style.display = "none";
        }

        for (const stashed_status_id in stashed_statuses) {
            const stashed_status = stashed_statuses[stashed_status_id];

            this.add_stash_row(stashed_status_id, stashed_status, current_selected_tokens.length);
        }

        init_drag(this.markeredit, this.markeredit_stash, (row_element, new_index) => {
            const status_id = row_element.querySelector(".statusicon").dataset.tag;
            this.controller.reorder_status(status_id, new_index);
        });

        this.restore_scrollbox();
    }
};
