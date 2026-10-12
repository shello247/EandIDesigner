"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import {
  ChevronDown,
  Copy,
  Hash,
  PackagePlus,
  Plus,
  StickyNote,
  Table2
} from "lucide-react";

export function DrawingCanvasAddMenu({
  onAddPanel,
  onAddTerminalBlock,
  onCopyTerminalBlock,
  onAddNote,
  onAddConnectedWireSchedule,
  canAddConnectedWireSchedule,
  disabled = false,
  showDrawingItems = true
}: {
  onAddPanel: () => void;
  onAddTerminalBlock: () => void;
  onCopyTerminalBlock: () => void;
  onAddNote: () => void;
  onAddConnectedWireSchedule: () => void;
  canAddConnectedWireSchedule: boolean;
  disabled?: boolean;
  showDrawingItems?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const initialFocusRef = useRef<"first" | "last">("first");

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
    const items = rootRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)');
    items?.[initialFocusRef.current === "last" ? items.length - 1 : 0]?.focus();
    document.addEventListener("pointerdown", closeOnOutsidePointer);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
    };
  }, [isOpen]);

  const runAction = (action: () => void) => {
    setIsOpen(false);
    // Dialogs should restore focus to a surviving launcher, not a removed item.
    triggerRef.current?.focus();
    action();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && isOpen) {
      event.preventDefault();
      event.stopPropagation();
      setIsOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (event.key === "Tab" && isOpen) {
      setIsOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) || disabled) return;
    event.preventDefault();
    if (!isOpen) {
      initialFocusRef.current = event.key === "ArrowUp" || event.key === "End" ? "last" : "first";
      setIsOpen(true);
      return;
    }
    const items = Array.from(rootRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? []);
    const current = items.findIndex((item) => item === document.activeElement);
    const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1
      : (current + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
    items[next]?.focus();
  };

  return (
    <div
      ref={rootRef}
      className="drawing-canvas-add-menu"
      data-testid="drawing-canvas-add-menu"
      onKeyDown={handleKeyDown}
    >
      <button
        type="button"
        ref={triggerRef}
        className="icon-button h-9"
        disabled={disabled}
        aria-label="Add to drawing"
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-controls={menuId}
        title="Add to drawing"
        onClick={() => {
          initialFocusRef.current = "first";
          setIsOpen((current) => !current);
        }}
      >
        <Plus aria-hidden="true" size={15} />
        <span>Add</span>
        <ChevronDown
          aria-hidden="true"
          size={13}
          className={isOpen ? "rotate-180 transition-transform" : "transition-transform"}
        />
      </button>

      {isOpen && !disabled ? <div
        id={menuId}
        className="drawing-canvas-add-menu-panel"
        role="menu"
        aria-label="Add to drawing"
      >
        {showDrawingItems ? <button
          type="button"
          className="drawing-canvas-add-menu-item"
          role="menuitem"
          tabIndex={-1}
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
          tabIndex={-1}
          onClick={() => runAction(onAddTerminalBlock)}
        >
          <Hash aria-hidden="true" size={15} />
          <span>
            <span className="block font-semibold">Terminal Strip</span>
            <span className="block text-[10px] font-medium text-slate-500">
              Build a mixed structured terminal strip
            </span>
          </span>
        </button> : null}
        {showDrawingItems ? <button
          type="button"
          className="drawing-canvas-add-menu-item"
          role="menuitem"
          tabIndex={-1}
          onClick={() => runAction(onCopyTerminalBlock)}
        >
          <Copy aria-hidden="true" size={15} />
          <span>
            <span className="block font-semibold">Copy Existing Terminal Strip</span>
            <span className="block text-[10px] font-medium text-slate-500">
              Create independent equipment from an existing strip
            </span>
          </span>
        </button> : null}
        <button
          type="button"
          className="drawing-canvas-add-menu-item"
          role="menuitem"
          tabIndex={-1}
          onClick={() => runAction(onAddNote)}
        >
          <StickyNote aria-hidden="true" size={15} />
          <span>
            <span className="block font-semibold">Note</span>
            <span className="block text-[10px] font-medium text-slate-500">
              Add a drawing annotation
            </span>
          </span>
        </button>
        <button
          type="button"
          className="drawing-canvas-add-menu-item disabled:cursor-not-allowed disabled:opacity-50"
          role="menuitem"
          tabIndex={-1}
          disabled={!canAddConnectedWireSchedule}
          title={
            canAddConnectedWireSchedule
              ? "Add a schedule for the selected equipment"
              : "Select one managed electrical symbol first"
          }
          onClick={() => runAction(onAddConnectedWireSchedule)}
        >
          <Table2 aria-hidden="true" size={15} />
          <span>
            <span className="block font-semibold">Connected Wire Schedule</span>
            <span className="block text-[10px] font-medium text-slate-500">
              {canAddConnectedWireSchedule
                ? "List canonical wires for the selected equipment"
                : "Select one electrical symbol first"}
            </span>
          </span>
        </button>
      </div> : null}
    </div>
  );
}
