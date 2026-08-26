"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent
} from "react";
import {
  ChevronDown,
  Eye,
  FileDown
} from "lucide-react";

type PreviewMenuItem = {
  label: string;
  description: string;
  icon: typeof Eye;
} & (
  | { kind: "action"; onSelect: () => void }
  | { kind: "link"; href: string }
);

export function DrawingPreviewMenu({
  disabled = false,
  onPackagePreview,
  previewPdfHref
}: {
  disabled?: boolean;
  onPackagePreview: () => void;
  previewPdfHref: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLElement | null>>([]);
  const items: PreviewMenuItem[] = [
    {
      kind: "action",
      label: "Package Preview",
      description: "Review the complete drawing package",
      icon: Eye,
      onSelect: onPackagePreview
    },
    {
      kind: "link",
      label: "Preview PDF",
      description: "Open the PDF preview in a new tab",
      icon: FileDown,
      href: previewPdfHref
    }
  ];

  useEffect(() => {
    if (!isOpen) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target instanceof Node ? event.target : null;
      if (target && rootRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setIsOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  const openAndFocus = (index = 0) => {
    setIsOpen(true);
    window.requestAnimationFrame(() => itemRefs.current[index]?.focus());
  };

  const runAction = (action: () => void) => {
    setIsOpen(false);
    action();
  };

  const handleMenuKeyDown = (
    event: ReactKeyboardEvent<HTMLDivElement>
  ) => {
    const activeIndex = itemRefs.current.findIndex(
      (item) => item === document.activeElement
    );
    let nextIndex: number | null = null;

    if (event.key === "ArrowDown") {
      nextIndex = (activeIndex + 1) % items.length;
    } else if (event.key === "ArrowUp") {
      nextIndex = (activeIndex - 1 + items.length) % items.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = items.length - 1;
    }

    if (nextIndex === null) return;
    event.preventDefault();
    itemRefs.current[nextIndex]?.focus();
  };

  return (
    <div ref={rootRef} className="drawing-preview-menu">
      <button
        ref={triggerRef}
        type="button"
        className="icon-button h-9"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={menuId}
        onClick={() => setIsOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            openAndFocus(0);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            openAndFocus(items.length - 1);
          }
        }}
      >
        <Eye aria-hidden="true" size={18} />
        Preview
        <ChevronDown
          aria-hidden="true"
          size={16}
          className={isOpen ? "rotate-180 transition-transform" : "transition-transform"}
        />
      </button>
      {isOpen ? (
        <div
          id={menuId}
          className="drawing-preview-menu-panel"
          role="menu"
          aria-label="Drawing previews"
          onKeyDown={handleMenuKeyDown}
        >
          {items.map((item, index) => {
            const Icon = item.icon;
            const content = (
              <>
                <Icon aria-hidden="true" size={18} />
                <span>
                  <span className="block font-semibold">{item.label}</span>
                  <span className="block text-[10px] font-medium text-slate-500">
                    {item.description}
                  </span>
                </span>
              </>
            );

            if (item.kind === "link") {
              return (
                <a
                  key={item.label}
                  ref={(element) => {
                    itemRefs.current[index] = element;
                  }}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="drawing-preview-menu-item"
                  role="menuitem"
                  onClick={() => setIsOpen(false)}
                >
                  {content}
                </a>
              );
            }

            return (
              <button
                key={item.label}
                ref={(element) => {
                  itemRefs.current[index] = element;
                }}
                type="button"
                className="drawing-preview-menu-item"
                role="menuitem"
                onClick={() => runAction(item.onSelect)}
              >
                {content}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
