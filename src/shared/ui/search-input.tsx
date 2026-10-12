import type { ComponentPropsWithRef } from "react";
import { Search } from "lucide-react";

export type SearchInputProps = Omit<ComponentPropsWithRef<"input">, "type"> & {
  type?: "text" | "search";
  containerClassName?: string;
};

/** Shared search presentation; callers retain their labels, state and submit behavior. */
export function SearchInput({ containerClassName = "", className = "", type = "text", ...props }: SearchInputProps) {
  return <span className={`search-input ${containerClassName}`}>
    <input {...props} type={type} className={`field-input search-input-control ${className}`} />
    <Search className="search-input-icon" aria-hidden="true" focusable="false" size={15} />
  </span>;
}
