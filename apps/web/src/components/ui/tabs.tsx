"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

/**
 * Hướng của lần đổi tab gần nhất do người dùng bấm: 1 = sang tab bên phải, -1 = sang trái, 0 = chưa đổi lần nào.
 * Panel mới trượt vào theo hướng này. Lúc mới vào trang (0) thì không chạy — trang đã có hiệu ứng chuyển trang.
 */
const TabsDirectionContext = React.createContext<-1 | 0 | 1>(0);

const Tabs = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root>
>(({ onValueChange, value, defaultValue, ...props }, ref) => {
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const current = React.useRef(value ?? defaultValue);
  const [direction, setDirection] = React.useState<-1 | 0 | 1>(0);

  // Tab điều khiển từ ngoài (value) có thể đổi mà không qua onValueChange → giữ "tab hiện tại" cho khớp
  React.useEffect(() => {
    if (value !== undefined) current.current = value;
  }, [value]);

  // Thứ tự tab lấy từ DOM (TabsTrigger gắn data-st-tab), bỏ trigger của Tabs lồng bên trong panel
  const order = () => {
    const root = rootRef.current;
    if (!root) return [];
    return Array.from(root.querySelectorAll<HTMLElement>("[data-st-tab]"))
      .filter((t) => t.closest("[data-st-tabs]") === root)
      .map((t) => t.dataset.stTab);
  };

  return (
    <TabsDirectionContext.Provider value={direction}>
      <TabsPrimitive.Root
        ref={(node) => {
          rootRef.current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) ref.current = node;
        }}
        data-st-tabs=""
        value={value}
        defaultValue={defaultValue}
        onValueChange={(v) => {
          const tabs = order();
          const from = tabs.indexOf(current.current);
          const to = tabs.indexOf(v);
          setDirection(from === -1 || to === -1 || to > from ? 1 : -1);
          current.current = v;
          onValueChange?.(v);
        }}
        {...props}
      />
    </TabsDirectionContext.Provider>
  );
});
Tabs.displayName = TabsPrimitive.Root.displayName;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground",
      className
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    data-st-tab={props.value}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow",
      className
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => {
  // Radix chỉ mount panel đang chọn → mỗi lần đổi tab panel mới mount lại, animation CSS tự chạy
  const direction = React.useContext(TabsDirectionContext);
  return (
    <TabsPrimitive.Content
      ref={ref}
      className={cn(
        "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        direction === 1 && "st-tab-next",
        direction === -1 && "st-tab-prev",
        className
      )}
      {...props}
    />
  );
});
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
