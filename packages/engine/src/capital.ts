import { RULES } from "@autoflow/config";

export interface CapitalState {
  liquid: number;
  pool: number; // reinvestment pool
  reserved: number;
}

/** Where a reservation was drawn from, so a refund goes back to the same place. */
export interface Reservation {
  fromPool: number;
  fromLiquid: number;
}

export class InsufficientCapitalError extends Error {
  constructor(public readonly needed: number, public readonly available: number) {
    super(`Not enough free capital: need ${needed}, have ${available}`);
  }
}

export const total = (s: CapitalState) => s.liquid + s.pool + s.reserved;

/** Reserve a test budget: the Reinvestment Pool first, then liquid capital. */
export function reserve(s: CapitalState, amount: number): { state: CapitalState; reservation: Reservation } {
  if (amount < 0) throw new RangeError("amount must be >= 0");
  const free = s.liquid + s.pool;
  if (amount > free) throw new InsufficientCapitalError(amount, free);
  const fromPool = Math.min(s.pool, amount);
  const fromLiquid = amount - fromPool;
  return {
    state: { liquid: s.liquid - fromLiquid, pool: s.pool - fromPool, reserved: s.reserved + amount },
    reservation: { fromPool, fromLiquid },
  };
}

/** KILL or REJECT: give the reservation back to its source. */
export function refund(s: CapitalState, r: Reservation): CapitalState {
  return { liquid: s.liquid + r.fromLiquid, pool: s.pool + r.fromPool, reserved: s.reserved - (r.fromPool + r.fromLiquid) };
}

/**
 * Settle a launched test. The reserved budget is released, the net result
 * (which already accounts for the ad spend) is booked: profit is split
 * reinvestShare to the pool and the rest to liquid; a loss comes out of liquid.
 */
export function settle(s: CapitalState, r: Reservation, net: number): CapitalState {
  const reservedAmount = r.fromPool + r.fromLiquid;
  const released = { liquid: s.liquid + r.fromLiquid, pool: s.pool + r.fromPool, reserved: s.reserved - reservedAmount };
  if (net >= 0) {
    const toPool = net * RULES.reinvestShare;
    return { ...released, pool: released.pool + toPool, liquid: released.liquid + (net - toPool) };
  }
  return { ...released, liquid: released.liquid + net };
}
