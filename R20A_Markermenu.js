import { format_statusicon, parse_statuses } from "./utils.js";
import { init_drag } from "./dragging.js";

export var R20A_Markermenu = class {

    constructor(controller, overlay) {

        this.controller = controller;
        this.scrollbox = overlay.querySelector("details");
        this.row_template = document.getElementById("r20a-template-markeredit-row");

        this.markeredit = document.getElementById("r20a-markeredit");

        this.skip_next_markermenu_update = 0;

        this.current_active_statuses = {}
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

            const formatted = parse_statuses(status);

            for (const s of formatted) {
                /*
                {
                    token_count: 2,
                    message_varies: false,
                    message_numeric: false,
                    message: "msg",
                    raws: ["red@msg", "red@msg"]
                }
                */
                if (statuses[s.id]) {
                    statuses[s.id].token_count++;
                    if (statuses[s.id].message !== s.message) {
                        statuses[s.id].message_varies = true;
                    } else if (!statuses[s.id].message && s.message) {
                        statuses[s.id].message = s.message;
                    }
                } else {
                    statuses[s.id] = {
                        token_count: 1,
                        message: s.message,
                        message_varies: false,
                        message_numeric: false,
                        raws: [s.raw]
                    };
                }

                statuses[s.id].message_numeric |= Boolean(s.message.match("\\d+"));
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

        icon.ondblclick = (event) => {
            // Save the first raw as a favourite, dunno how else to handle varying messages
            this.controller.favouritesmenu.add_favourite(active_status.raws[0]);
            this.update_favourited_markers();
        }

        this.markeredit.appendChild(row);

        return {row: row, icon: icon};
    }

    save_scrollbox() {
        this.scrollbox_top = this.scrollbox.scrollTop;
        this.scrollbox_height = this.scrollbox.scrollHeight;
    }

    restore_scrollbox() {
        this.scrollbox.scrollTop = this.scrollbox_top + this.scrollbox.scrollHeight - this.scrollbox_height;
    }

    update_used_markers() {
        for (const status_id in this.controller.statusicons) {
            if (status_id in this.current_active_statuses) {
                this.controller.statusicons[status_id].markermenu_element.classList.add("active");
            } else {
                this.controller.statusicons[status_id].markermenu_element.classList.remove("active");
            }
        }
    }

    update_favourited_markers() {
        let current_favs = parse_statuses(this.controller.settings.favourite_statuses)

        for (const active_status_id in this.current_active_statuses) {

            let favourited = false;

            const active_status = this.current_active_statuses[active_status_id];
            for (const fav of current_favs) {
                if (!active_status.message_varies
                    && active_status_id === fav.id
                    && active_status.message === fav.message
                ) {
                    favourited = true;
                    break;
                }
            }

            if (favourited) {
                active_status.icon_element.classList.add("favourited");
            } else {
                active_status.icon_element.classList.remove("favourited");
            }
        }
    }

    update(current_selected_tokens) {
        if (this.skip_next_markermenu_update > 0) {
            this.skip_next_markermenu_update--;
            return;
        }

        this.save_scrollbox();

        this.markeredit.innerHTML = "";

        const active_statuses = this.collect_statuses(current_selected_tokens, "statusmarkers");

        for (const active_status_id in active_statuses) {

            let active_status = active_statuses[active_status_id];

            let eles = this.add_row(active_status_id, active_status, current_selected_tokens.length);
            active_status.icon_element = eles.icon;
        }

        this.current_active_statuses = active_statuses;

        init_drag(this.markeredit, (row_element, new_index) => {
            const status_id = row_element.querySelector(".statusicon").dataset.tag;
            this.controller.reorder_status(status_id, new_index);
        });

        this.update_used_markers();
        this.update_favourited_markers();

        this.restore_scrollbox();
    }
};
