"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Hash, PackagePlus, Plus } from "lucide-react";

export function DrawingCanvasAddMenu({
  onAddPanel,
  onAddTerminalBlock,
  onAddSheet,
  showDrawingItems = true
}: {
  onAddPanel: () => void;
  onAddTerminalBlock: () => void;
  onAddSheet: () => void;
  showDrawingItems?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target instanceof Node ? event.target : null;

      if (target && rootRef.current?.contains(target)) {
        return;
      }

      setIsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  const runAction = (action: () => void) => {
    setIsOpen(false);
    action();
  };

  return (
    <div
      ref={rootRef}
      className="drawing-canvas-add-menu"
      data-testid="drawing-canvas-add-menu"
    >
      <button
        type="button"
        className="drawing-canvas-add-menu-trigger"
        aria-label="Add to drawing"
        aria-expanded={isOpen}
        aria-controls={menuId}
        title="Add to drawing"
        onClick={() => setIsOpen((current) => !current)}
      >
        <Plus aria-hidden="true" size={15} />
        <span>Add</span>
        <ChevronDown
          aria-hidden="true"
          size={13}
          className={isOpen ? "rotate-180 transition-transform" : "transition-transform"}
        />
      </button>

      <div
        id={menuId}
        className={isOpen ? "drawing-canvas-add-menu-panel" : "hidden"}
        role="menu"
      >
        {showDrawingItems ? <button
          type="button"
          className="drawing-canvas-add-menu-item"
          role="menuitem"
          onClick={() => runAction(onAddPanel)}
        >
          <PackagePlus aria-hidden="true" size={15} />
          <span>
            <span className="block font-semibold">Panel / enclosure</span>
            <span className="block text-[10px] font-medium text-slate-500">
              Add a visible panel box
            </span>
          </span>
        </button> : null}
        {showDrawingItems ? <button
          type="button"
          className="drawing-canvas-add-menu-item"
          role="menuitem"
          onClick={() => runAction(onAddTerminalBlock)}
        >
          <Hash aria-hidden="true" size={15} />
          <span>
            <span className="block font-semibold">Terminal block</span>
            <span className="block text-[10px] font-medium text-slate-500">
              Add a modular TB strip
            </span>
          </span>
        </button> : null}
        <button
          type="button"
          className="drawing-canvas-add-menu-item"
          role="menuitem"
          onClick={() => runAction(onAddSheet)}
        >
          <Plus aria-hidden="true" size={15} />
          <span>
            <span className="block font-semibold">Sheet</span>
            <span className="block text-[10px] font-medium text-slate-500">
              Add drawing, section, or panel page
            </span>
          </span>
        </button>
      </div>
    </div>
  );
}
