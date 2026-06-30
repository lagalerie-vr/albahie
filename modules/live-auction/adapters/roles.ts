// Pure role-mapping logic, shared by the Next adapters and the WS server so the
// permission model is defined in exactly one place.

import type { AuctionRole, PermissionAction } from "./types";

/** Map a host platform role (profiles.role) to auction roles. */
export function rolesForHostRole(hostRole: string | null | undefined): AuctionRole[] {
  switch (hostRole) {
    case "admin":
      return ["manage", "auctioneer", "clerk", "bidder"];
    case "staff":
      return ["clerk", "bidder"];
    default:
      return ["bidder"];
  }
}

export function permitted(roles: AuctionRole[], action: PermissionAction): boolean {
  switch (action) {
    case "auction.manage":
      return roles.includes("manage");
    case "auction.clerk":
      return roles.includes("clerk") || roles.includes("auctioneer");
    case "auction.bid":
      return roles.includes("bidder");
    default:
      return false;
  }
}
