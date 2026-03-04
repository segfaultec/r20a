export var R20A_StatusEditor = class {
    set_status = null;
    get_status = null;
    debug_label = "?";

    constructor(setter, getter) {
        this.set_status = setter;
        this.get_status = getter;
    }

    static from_token(token, model_key) {
        let setter = (new_status) => {
            let payload = {};
            payload[model_key] = new_status;
            token.model.save(payload);
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
            message = message.replaceAll("@", "").replaceAll(",", "");
        }

        const old_statuses = this.get_status();
        const new_status_entry = (message ? `${statusid}@${message}` : statusid);

        const old_status_list = old_statuses
            .split(",")
            .map((s) => s.split("@")[0]);

        let found_existing = false;

        let new_statuses = old_statuses.split(",");
        for (let idx = 0; idx < new_statuses.length; idx++) {
            const new_status = new_statuses[idx];
            if (new_status.split("@")[0] == statusid) {
                new_statuses[idx] = new_status_entry;
                found_existing = true;
            }
        }

        if (!found_existing) {
            new_statuses.push(new_status_entry);   
        }

        this.update_token_status(new_statuses.join(","), "add");
    }

    remove_status(statusid) {
        let removed_elements = [];

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
                        let number = parseInt(match[1]);
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
            .join(",");
        this.update_token_status(new_statuses, "bump");
    }

    edit_status(statusid, new_message) {
        if (new_message) {
            new_message = new_message.replaceAll("@", "").replaceAll(",", "");
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
        this.update_token_status(new_statuses, "edit");
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
};
