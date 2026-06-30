import type { LucideIcon } from "lucide-react";
import {
  Gavel,
  Package,
  Users,
  ClipboardList,
  Receipt,
  Truck,
  BarChart3,
  Settings,
  Scale,
  Boxes,
} from "lucide-react";

export type UserRole = "admin" | "staff";

export type ModuleStatus = "available" | "coming-soon";

export interface AppModule {
  /** Stable identifier, also used as the URL segment. */
  key: string;
  name: string;
  description: string;
  href: string;
  icon: LucideIcon;
  status: ModuleStatus;
  /** Roles allowed to see this module. Omit = all authenticated users. */
  roles?: UserRole[];
}

/**
 * The launchpad registry. As we build each module, flip its status to
 * "available" and point `href` at its route. Adding a brand-new module is
 * just appending an entry here.
 */
export const MODULES: AppModule[] = [
  {
    key: "consignments",
    name: "Consignments",
    description: "Intake, agreements, and seller property tracking.",
    href: "/consignments",
    icon: ClipboardList,
    status: "available",
  },
  {
    key: "appraisal",
    name: "Appraisal",
    description: "Manager decisions: accept, reject, or extend the review window.",
    href: "/appraisal",
    icon: Scale,
    status: "available",
  },
  {
    key: "inventory",
    name: "Inventory",
    description: "Every item, its location, and a full history of changes.",
    href: "/inventory",
    icon: Boxes,
    status: "available",
  },
  {
    key: "catalogue",
    name: "Catalogue & Lots",
    description: "Create auctions, add and order lots, build sales from inventory.",
    href: "/catalogue",
    icon: Package,
    status: "available",
  },
  {
    key: "clients",
    name: "Clients",
    description: "Buyers, sellers, paddles, and KYC records.",
    href: "/clients",
    icon: Users,
    status: "available",
  },
  {
    key: "auctions",
    name: "Live Auction",
    description: "Stream and run live sales: OBS video, console, real-time bidding.",
    href: "/auctions",
    icon: Gavel,
    status: "available",
  },
  {
    key: "invoicing",
    name: "Invoicing & Payments",
    description: "Buyer invoices, seller settlements, and premiums.",
    href: "/invoicing",
    icon: Receipt,
    status: "available",
  },
  {
    key: "logistics",
    name: "Logistics & Shipping",
    description: "Storage, collection, and shipment of property.",
    href: "/logistics",
    icon: Truck,
    status: "coming-soon",
  },
  {
    key: "reports",
    name: "Reports",
    description: "Sale performance, revenue, and operational dashboards.",
    href: "/reports",
    icon: BarChart3,
    status: "available",
  },
  {
    key: "settings",
    name: "Administration",
    description: "Users, roles, and house-wide settings.",
    href: "/settings",
    icon: Settings,
    status: "available",
    roles: ["admin"],
  },
];

