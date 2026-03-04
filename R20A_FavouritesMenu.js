import { format_statusicon, parse_single_status, parse_statuses, unparse_single_status, unparse_statuses } from "./utils.js";

export var R20A_FavouritesMenu = class {

    controller = null
    menu = null
    entry_template = null

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
        this.update();
    }

    update_used_favourites() {

    }

    update() {
        this.menu.innerHTML = ""

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

            text.innerText = status.message;

            closebtn.onclick = (event) => {
                this.remove_favourite(unparse_single_status(status));
            }

            this.menu.appendChild(entry);
        }

        this.update_used_favourites();
    }

    add_favourite(new_fav) {
        let new_fav_formatted = parse_single_status(new_fav)
        let formatted = parse_statuses(this.get_current_statuses())

        let found = false;
        for (let idx = 0; idx < formatted.length; idx++) {
            if (formatted[idx].id === new_fav_formatted.id) {
                found = true;
                formatted[idx].message = new_fav_formatted.message;
                break;
            }
        }

        if (!found) {
            formatted.push(new_fav_formatted)
        }

        const new_statuses = unparse_statuses(formatted);
        this.set_current_statuses(new_statuses);
    }

    remove_favourite(old_fav) {
        let old_fav_formatted = parse_single_status(old_fav);

        let formatted = parse_statuses(this.get_current_statuses())
        for (let idx = 0; idx < formatted.length; idx++) {
            if (formatted[idx].id === old_fav_formatted.id) {
                formatted.removeAt(idx);
                break;
            }
        }

        const new_statuses = unparse_statuses(formatted);
        this.set_current_statuses(new_statuses); 
    }
}