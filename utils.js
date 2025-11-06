
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
