// Mock host adapters — let the module run in complete isolation (no host).
import type { HostAdapters, HostUser, PlatformEvent } from "./types";
import { PermissionError } from "./types";
import { permitted } from "./roles";

const MOCK_USER: HostUser = {
  id: "00000000-0000-0000-0000-000000000001",
  displayName: "Demo Auctioneer",
  roles: ["manage", "auctioneer", "clerk", "bidder"],
};

export const mockAdapters: HostAdapters = {
  async getCurrentUser() {
    return MOCK_USER;
  },
  async assertPermission(userId, action) {
    // The mock user can do everything; anyone else only bids.
    const roles = userId === MOCK_USER.id ? MOCK_USER.roles : (["bidder"] as const);
    if (!permitted([...roles], action)) throw new PermissionError(action);
  },
  async recordCharge(userId, lotId, amountCents) {
    console.log(`[mock] recordCharge user=${userId} lot=${lotId} amount=${amountCents}c`);
  },
  async emitPlatformEvent(event: PlatformEvent) {
    console.log(`[mock] platformEvent ${event.type}`, event);
  },
};
