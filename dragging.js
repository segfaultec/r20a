var currentDragRow = null;
export function init_drag(root, reorder_event) {
    for (let handle of root.querySelectorAll(".r20a-draghandle")) {
        handle.addEventListener("dragstart", (ev) => {

            currentDragRow = ev.target.parentElement;
            currentDragRow.style.opacity = 0.3;

            ev.dataTransfer.dropEffect = "move";
        });
        handle.addEventListener("dragend", (ev) => {
            currentDragRow.style.opacity = 1.0;

            Array.from(root.querySelectorAll(".r20a-dragrow"))
                .sort((a, b) => { return a.style.order - b.style.order; })
                .entries()
                .forEach(([index, row]) => {
                    row.style.order = index * 2;
                });

            if (typeof reorder_event === "function") {
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
            if (currentDragRow && ev.currentTarget !== currentDragRow) {
                const currentOrder = currentDragRow.style.order;
                const targetOrder = ev.currentTarget.style.order;
                currentDragRow.style.order = targetOrder - Math.sign(currentOrder - targetOrder);
            }
        });
        index++;
    }
}
