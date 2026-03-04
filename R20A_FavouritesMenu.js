import { format_statusicon, parse_single_status, parse_statuses, unparse_single_status, unparse_statuses } from "./utils.js";

export var R20A_FavouritesMenu = class {

    controller = null
    menu = null
    entry_template = null
    current_favourites = []

    constructor(controller, overlay) {
        this.controller = controller;
        this.menu = overlay.querySelector("#r20a-favouritemenu")
        this.entry_template = document.getElementById("r20a-template-favouriteentry")
    }

    get_current_statuses() {
        return this.controller.settings.favourite_statuses;
    }

    set_current_statuses(new_favourites) {
        this.controller.settings.favourite_statuses = new_favourites;
        this.controller.save_settings();
        this.controller.update_favourites();
        this.update();
    }

    update_used_favourites() {
        const active_statuses = this.controller.get_current_active_statuses();

        for (const fav of this.current_favourites) {

            let active = false;

            const active_fav = active_statuses[fav.id];
            if (active_fav !== undefined) {
                if (!active_fav.message_varies && active_fav.message == fav.message) {
                    active = true;
                }
            }

            if (active)
            {
                fav.icon_element.classList.add("active");
            }
            else
            {
                fav.icon_element.classList.remove("active");
            }
        }
    }

    update() {
        this.menu.innerHTML = ""
        this.current_favourites = []

        for (const status of parse_statuses(this.get_current_statuses())) {
            let entry = this.entry_template.content.cloneNode(true);
            let statusicon = entry.querySelector(".statusicon");
            let text = entry.querySelector(".r20a-text");
            let closebtn = entry.querySelector(".r20a-closebtn");

            let status_value = this.controller.statusicons[status.id];
            if (typeof status_value === "undefined") {
                status_value = {
                    type: "unknown",
                    id: status.id,
                    name: status.id
                };
            }

            format_statusicon(statusicon, status.id, status_value);

            statusicon.onclick = (event) => {
                let active = event.currentTarget.classList.contains("active");
                if (active) {
                    this.controller.remove_status(status.id)
                } else {
                    this.controller.add_status(status.id, status.message)
                }
            }

            text.innerText = status.message;

            closebtn.onclick = (event) => {
                this.remove_favourite(status.id, status.message);
            }

            this.menu.appendChild(entry);

            this.current_favourites.push({
                id: status.id,
                message: status.message,
                icon_element: statusicon
            });
        }

        this.update_used_favourites();
    }

    add_favourite(fav_id, fav_message) {
        let new_fav_formatted = {id: fav_id, message: fav_message}
        let formatted = parse_statuses(this.get_current_statuses())
        formatted.push(new_fav_formatted)

        const new_statuses = unparse_statuses(formatted);
        this.set_current_statuses(new_statuses);
    }

    remove_favourite(fav_id, fav_message) {
        let old_fav_formatted =  {id: fav_id, message: fav_message}

        let formatted = parse_statuses(this.get_current_statuses())
        for (let idx = 0; idx < formatted.length; idx++) {
            if (formatted[idx].id === old_fav_formatted.id
                && formatted[idx].message === old_fav_formatted.message
            ) {
                formatted.removeAt(idx);
                break;
            }
        }

        const new_statuses = unparse_statuses(formatted);
        this.set_current_statuses(new_statuses); 
    }
}