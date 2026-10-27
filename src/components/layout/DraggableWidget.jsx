import React, { useEffect, useState } from "react";

const DraggableWidget = ({
  widget,
  children,
  onUpdateWidget,
  onRemoveWidget,
  onFocusWidget,
  containerRect,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // unified pointer coordinate extractor
  const getClientXY = (e) => {
    // Pointer events always have clientX/Y, but keep a fallback for touch
    if (e.touches?.length) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    if (e.changedTouches?.length) {
      return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
    }
    return { x: e.clientX, y: e.clientY };
  };

  useEffect(() => {
    const handleMove = (e) => {
      if (!isDragging) return;
      const { x: clientX, y: clientY } = getClientXY(e);

      let newX = clientX - dragStart.x;
      let newY = clientY - dragStart.y;

      if (containerRect) {
        const maxX = containerRect.width - widget.size.w;
        const maxY = containerRect.height - widget.size.h;
        newX = Math.min(Math.max(0, newX), Math.max(0, maxX));
        newY = Math.min(Math.max(0, newY), Math.max(0, maxY));
      }

      onUpdateWidget(widget.id, {
        ...widget,
        position: { x: newX, y: newY },
      });
    };

    const handleUp = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleUp);
    }
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [isDragging, dragStart, widget, onUpdateWidget, containerRect]);

  const handlePointerDown = (e) => {
    onFocusWidget?.(widget.id);
    if (e.cancelable) e.preventDefault(); // stop scroll on touch
    const { x, y } = getClientXY(e);
    setIsDragging(true);
    setDragStart({
      x: x - widget.position.x,
      y: y - widget.position.y,
    });
  };

  return (
    <div
      style={{
        position: "absolute",
        left: widget.position.x,
        top: widget.position.y,
        width: widget.size.w,
        height: widget.size.h,
        zIndex: widget.zIndex || 1,
      }}
    >
      <div className="rounded-xl shadow-sm ring-1 ring-gray-200 dark:ring-gray-700 overflow-hidden bg-white dark:bg-gray-800">
        <div
          className="drag-handle cursor-move select-none px-3 py-3 flex items-center justify-between bg-gray-50 dark:bg-gray-900/70 border-b border-gray-200 dark:border-gray-700"
          onPointerDown={handlePointerDown}
          style={{ touchAction: "none" }} // disable browser panning
        >
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-red-400"></span>
            <span className="inline-block w-2 h-2 rounded-full bg-yellow-400"></span>
            <span className="inline-block w-2 h-2 rounded-full bg-green-400"></span>
            <span className="ml-2 font-medium text-gray-800 dark:text-gray-100">
              {widget.type}
            </span>
          </div>
          <button
            className="text-gray-600 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 px-2 py-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
            onClick={() => onRemoveWidget?.(widget.id)}
            aria-label="Close widget"
          >
            ✕
          </button>
        </div>

        <div className="p-3 overflow-y-auto overflow-x-hidden" style={{ maxHeight: "calc(100% - 56px)" }}>
          {React.isValidElement(children)
            ? React.cloneElement(children, {
                widgetId: widget.id,
                onUpdateWidgetProps: (newProps) =>
                  onUpdateWidget(widget.id, {
                    ...widget,
                    props: { ...(widget.props || {}), ...newProps },
                  }),
              })
            : children}
        </div>
      </div>
    </div>
  );
};

export default DraggableWidget;
