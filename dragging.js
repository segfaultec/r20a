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

export var DragPositioningHandler = class {
    offset = [0,0]
    current = [0,0]
    isDown = false
    root = null
    onfinished = null

    constructor(root, handle, onfinished) {
        this.root = root;
        this.onfinished = onfinished;
        // Prevent handle click from toggling the details panel
        handle.addEventListener("click", (event) => {
            event.preventDefault();
        })
        handle.addEventListener("mousedown", this.mousedown_handler.bind(this), true);
        document.addEventListener("mouseup", this.mouseup_handler.bind(this), true);
        document.addEventListener("mousemove", this.mousemove_handler.bind(this), true);
        window.addEventListener("resize", this.windowresize_handler.bind(this), true);
    }

    mousedown_handler(event) {
        this.isDown = true;
        this.offset = [
            this.root.offsetLeft - event.clientX,
            this.root.offsetTop - event.clientY
        ]
    }

    mouseup_handler(event) {
        if (this.isDown) {
            this.isDown = false;
            this.onfinished?.(this.current);
        }
    }

    mousemove_handler(event) {
        if (this.isDown) {
            this.apply_position([
                event.clientX + this.offset[0],
                event.clientY + this.offset[1]
            ])
        }
    }

    windowresize_handler(event) {
        this.apply_position(this.current)
    }

    apply_position(position) {
        const padding = [5, 30, 30, 5];

        const clamp = (x, min, max) => {
            return Math.min(Math.max(x, min), max)
        }

        var inbounds_position = [
            clamp(position[0], padding[3], window.innerWidth - padding[1]),
            clamp(position[1], padding[0], window.innerHeight - padding[2])
        ]

        this.current = inbounds_position;

        this.root.style.left = this.current[0] + "px";
        this.root.style.top = this.current[1] + "px";
    }
}