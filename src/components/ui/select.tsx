"use client";

import { forwardRef } from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { cn } from "@/lib/utils";

/**
 * Styled Radix Select wrapper. Swaps the native `<select>` element
 * (whose dropdown position is controlled by the OS and anchors to
 * the current value on macOS) for a portal-rendered menu that
 * always anchors flush below the trigger.
 *
 * Usage mirrors shadcn's composable API:
 *
 *   <Select value={v} onValueChange={setV}>
 *     <SelectTrigger id="foo" className="..."><SelectValue /></SelectTrigger>
 *     <SelectContent>
 *       <SelectItem value="a">A</SelectItem>
 *       <SelectItem value="b">B</SelectItem>
 *     </SelectContent>
 *   </Select>
 *
 * The trigger accepts the same id/className props the old <select>
 * used, so `<label htmlFor="...">` pairing keeps working.
 */

const Select = SelectPrimitive.Root;
const SelectGroup = SelectPrimitive.Group;
const SelectValue = SelectPrimitive.Value;

const SelectTrigger = forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      // Match the native <select> look used throughout the app —
      // white pill with charcoal-lighter border, rounded, primary-
      // ring focus. `justify-between` + explicit caret keeps the
      // layout stable regardless of value length.
      "flex w-full items-center justify-between gap-2 rounded-md border border-charcoal-lighter/20 bg-white px-3 py-2 text-sm text-charcoal",
      "focus:border-primary-400 focus:outline-none focus:ring-1 focus:ring-primary-400",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "data-[placeholder]:text-charcoal-lighter",
      className
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="opacity-60 shrink-0"
        aria-hidden="true"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = "SelectTrigger";

const SelectContent = forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      position={position}
      // `popper` anchors the content to the trigger. `sideOffset=4`
      // leaves a small gap so the menu doesn't visually fuse with
      // the field. z-50 keeps it above sticky headers (z-40).
      sideOffset={4}
      className={cn(
        "relative z-50 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md border border-charcoal-lighter/20 bg-white shadow-dropdown",
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        className
      )}
      {...props}
    >
      <SelectPrimitive.Viewport className="p-1">
        {children}
      </SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = "SelectContent";

const SelectItem = forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-pointer select-none items-center rounded-sm py-1.5 pl-2 pr-7 text-sm text-charcoal outline-none",
      "focus:bg-primary-50 focus:text-charcoal",
      "data-[state=checked]:font-medium",
      "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
  >
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-primary-500"
          aria-hidden="true"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </SelectPrimitive.ItemIndicator>
    </span>
  </SelectPrimitive.Item>
));
SelectItem.displayName = "SelectItem";

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectItem,
};
