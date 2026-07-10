"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  DraftingCompass,
  LibraryBig,
  PanelLeftClose,
  PanelLeftOpen,
  Plus
} from "lucide-react";

const navItems = [
  {
    href: "/symbols",
    label: "Symbols",
    icon: LibraryBig,
    isActive: (pathname: string) =>
      pathname === "/symbols" ||
      (pathname.startsWith("/symbols/") && pathname !== "/symbols/new")
  },
  {
    href: "/drawings",
    label: "Drawings",
    icon: DraftingCompass,
    isActive: (pathname: string) =>
      pathname === "/drawings" || pathname.startsWith("/drawings/")
  },
  {
    href: "/symbols/new",
    label: "New symbol",
    icon: Plus,
    isActive: (pathname: string) => pathname === "/symbols/new"
  }
];

export function AppSidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <aside
      className={[
        "app-sidebar",
        isCollapsed ? "app-sidebar-collapsed" : "app-sidebar-expanded"
      ].join(" ")}
      aria-label="Primary navigation"
    >
      <div className="flex h-full flex-col">
        <div className="flex h-14 items-center gap-3 border-b border-slate-200 px-3">
          {isCollapsed ? null : (
            <Link
              href="/symbols"
              className="flex min-w-0 flex-1 items-center gap-3 text-slate-950"
              title="EI Designer"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-teal-200 bg-teal-50 text-[12px] font-bold text-teal-800">
                EI
              </span>
              <span className="truncate text-sm font-semibold">EI Designer</span>
            </Link>
          )}
          <button
            type="button"
            className="sidebar-toggle"
            onClick={() => setIsCollapsed((current) => !current)}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <PanelLeftOpen aria-hidden="true" size={17} />
            ) : (
              <PanelLeftClose aria-hidden="true" size={17} />
            )}
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = item.isActive(pathname);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "sidebar-nav-item",
                  active ? "sidebar-nav-item-active" : "",
                  isCollapsed ? "justify-center px-0" : ""
                ].join(" ")}
                title={item.label}
              >
                <Icon aria-hidden="true" size={17} />
                <span className={isCollapsed ? "sr-only" : ""}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
