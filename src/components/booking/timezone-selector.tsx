"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { getTimezones } from "@/lib/utils/timezone";

export interface TimezoneSelectorProps {
  value: string;
  onChange: (tz: string) => void;
  className?: string;
  inputId?: string;
}

/**
 * Filters timezones by case-insensitive substring match.
 * Exported for property-based testing.
 */
export function filterTimezones(timezones: string[], query: string): string[] {
  const lowerQuery = query.trim().toLowerCase();

  if (!lowerQuery) return timezones;

  return timezones.filter((tz) => tz.toLowerCase().includes(lowerQuery));
}

const TimezoneSelector = React.forwardRef<HTMLDivElement, TimezoneSelectorProps>(
  ({ value, onChange, className, inputId }, ref) => {
    const [open, setOpen] = React.useState(false);
    const [query, setQuery] = React.useState("");
    const [highlightedIndex, setHighlightedIndex] = React.useState(0);
    const inputRef = React.useRef<HTMLInputElement>(null);
    const listRef = React.useRef<HTMLUListElement>(null);
    const containerRef = React.useRef<HTMLDivElement>(null);
    const generatedListboxId = React.useId();

    const timezones = React.useMemo(() => getTimezones(), []);
    const filtered = React.useMemo(
      () => filterTimezones(timezones, query),
      [timezones, query]
    );

    // Reset highlighted index when filtered list changes
    React.useEffect(() => {
      setHighlightedIndex(0);
    }, [filtered]);

    // Scroll highlighted item into view
    React.useEffect(() => {
      if (open && listRef.current) {
        const item = listRef.current.children[highlightedIndex] as HTMLElement;
        if (item) {
          item.scrollIntoView({ block: "nearest" });
        }
      }
    }, [highlightedIndex, open]);

    // Close dropdown on outside click
    React.useEffect(() => {
      function handleClickOutside(event: MouseEvent) {
        if (
          containerRef.current &&
          !containerRef.current.contains(event.target as Node)
        ) {
          setOpen(false);
        }
      }
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    function handleSelect(tz: string) {
      onChange(tz);
      setQuery("");
      setOpen(false);
      inputRef.current?.blur();
    }

    function handleInputFocus() {
      setOpen(true);
      setQuery("");
    }

    function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          setOpen(true);
          setHighlightedIndex((prev) =>
            prev < filtered.length - 1 ? prev + 1 : prev
          );
          break;
        case "ArrowUp":
          event.preventDefault();
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
          break;
        case "Enter":
          event.preventDefault();
          if (open && filtered[highlightedIndex]) {
            handleSelect(filtered[highlightedIndex]);
          }
          break;
        case "Escape":
          event.preventDefault();
          setOpen(false);
          setQuery("");
          inputRef.current?.blur();
          break;
      }
    }

    return (
      <div ref={containerRef} className={cn("relative", className)}>
        <div ref={ref}>
          <input
            ref={inputRef}
            id={inputId}
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls={generatedListboxId}
            aria-autocomplete="list"
            aria-activedescendant={
              open && filtered[highlightedIndex]
                ? `${generatedListboxId}-option-${highlightedIndex}`
                : undefined
            }
            aria-label={inputId ? undefined : "Timezone"}
            value={open ? query : value}
            placeholder={value || "Search timezone..."}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={handleInputFocus}
            onKeyDown={handleKeyDown}
            className={cn(
              "flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background",
              "placeholder:text-muted-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              "disabled:cursor-not-allowed disabled:opacity-50"
            )}
          />
        </div>
        {open && filtered.length > 0 && (
          <ul
            id={generatedListboxId}
            ref={listRef}
            role="listbox"
            aria-label="Timezone options"
            className="absolute z-50 mt-1 max-h-60 w-full overflow-auto border border-border rounded-md shadow-md bg-card"
          >
            {filtered.map((tz, index) => (
              <li
                key={tz}
                id={`${generatedListboxId}-option-${index}`}
                role="option"
                aria-selected={tz === value}
                className={cn(
                  "cursor-pointer px-3 py-2 text-sm",
                  index === highlightedIndex && "bg-accent text-accent-foreground",
                  tz === value && "font-medium"
                )}
                onMouseEnter={() => setHighlightedIndex(index)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(tz);
                }}
              >
                {tz}
              </li>
            ))}
          </ul>
        )}
        {open && filtered.length === 0 && query && (
          <div className="absolute z-50 mt-1 w-full border border-border rounded-md shadow-md bg-card px-3 py-2 text-sm text-muted-foreground">
            No timezones found
          </div>
        )}
      </div>
    );
  }
);

TimezoneSelector.displayName = "TimezoneSelector";

export { TimezoneSelector };
