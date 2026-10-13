import type { TargetAndTransition, Transition, Variants } from "framer-motion";

/**
 * SmartTask Motion Design System Tokens (SaaS Standard)
 * Khống chế thời gian phản hồi xúc giác (tactile micro-tap) dưới 120ms
 * và chuyển động dải chỉ thị tab / modal dưới 180ms bằng spring physics.
 */

// ── 1. Cấu hình Lò xo (Spring Physics) ──────────────────────────
export const springs = {
  /** Nút bấm & Micro-interactions: cực nhanh, đàn hồi cao, hoàn tất dưới 120ms */
  tap: {
    type: "spring",
    stiffness: 450,
    damping: 25,
    mass: 0.8,
  } as Transition,

  /** IconButton nhỏ (nhỏ gọn nảy mạnh hơn) */
  iconTap: {
    type: "spring",
    stiffness: 500,
    damping: 24,
    mass: 0.7,
  } as Transition,

  /** Dải chỉ thị Tab (layoutId): mượt mà, bám dính tự nhiên */
  tab: {
    type: "spring",
    stiffness: 380,
    damping: 30,
    mass: 0.9,
  } as Transition,

  /** Thẻ việc thả xuống hoặc dời chỗ (reorder / drop) */
  cardDrop: {
    type: "spring",
    stiffness: 350,
    damping: 28,
  } as Transition,

  /** Drawer trượt từ cạnh hoặc thanh bên mở rộng */
  drawer: {
    type: "spring",
    stiffness: 320,
    damping: 28,
  } as Transition,

  /** Hộp thoại / Popover phóng to từ tâm */
  dialog: {
    type: "spring",
    stiffness: 340,
    damping: 26,
  } as Transition,
};

// ── 2. Preset Tương tác (Interaction Presets) ───────────────────
export const motionTokens = {
  // Nút bấm tiêu chuẩn
  buttonTap: {
    scale: 0.97,
    transition: springs.tap,
  } satisfies TargetAndTransition,
  buttonHover: {
    scale: 1.01,
    transition: { duration: 0.1, ease: "easeOut" as const },
  } satisfies TargetAndTransition,

  // Nút biểu tượng (Icon Button)
  iconButtonTap: {
    scale: 0.92,
    transition: springs.iconTap,
  },

  // Chip hành động / Pill tag
  chipTap: {
    scale: 0.95,
    transition: springs.tap,
  },

  // Kéo thả thẻ việc (Kanban & Eisenhower)
  cardGrab: {
    scale: 1.025,
    rotate: 0.8,
    boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
  },
  cardDrop: {
    scale: 1,
    rotate: 0,
    transition: springs.cardDrop,
  },
};

// ── 3. Chuyển đổi Nội dung (Transition Variants) ───────────────
export const contentVariants: Variants = {
  initial: {
    opacity: 0,
    y: 4,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.13,
      ease: [0.16, 1, 0.3, 1], // easeOutExpo
    },
  },
  exit: {
    opacity: 0,
    y: -4,
    transition: {
      duration: 0.1,
      ease: "easeIn",
    },
  },
};

/** Hiệu ứng hiển thị danh sách so le (Staggered list) */
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.035,
      delayChildren: 0.02,
    },
  },
};

export const staggerItem: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 28,
    },
  },
};

/** Accordion / Mở rộng chiều cao form thêm việc nhanh */
export const accordionExpand: Variants = {
  collapsed: {
    height: 0,
    opacity: 0,
    overflow: "hidden",
    transition: { duration: 0.15, ease: "easeInOut" },
  },
  expanded: {
    height: "auto",
    opacity: 1,
    overflow: "visible",
    transition: {
      type: "spring",
      stiffness: 350,
      damping: 28,
    },
  },
};
