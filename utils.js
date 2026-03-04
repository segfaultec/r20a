
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

export function parse_single_status(status) {
    let split = status.split("@");
    const status_id = split[0];
    if (status_id === "") {
        return null;
    }
    const status_message = split[1] ? split[1] : "";

    return {id: status_id, message: status_message, raw: status};
}

export function parse_statuses(statuses) {
    let formatted = []
    for (const s of statuses.split(",")) {
        const parsed = parse_single_status(s)
        if (parsed)
        {
            formatted.push(parsed);
        }
    }
    return formatted;
}

export function unparse_single_status(s) {
    let status = s.id
    if (s.message) {
        status += "@" + s.message
    }
    return status
}

export function unparse_statuses(formatted) {
    let statuses = ""
    for (let idx = 0; idx < formatted.length; idx++) {
        statuses += unparse_single_status(formatted[idx])

        if (idx < formatted.length - 1) {
            statuses += ","
        }
    }
    return statuses
}