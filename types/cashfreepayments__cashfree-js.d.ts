declare module "@cashfreepayments/cashfree-js" {
  export type CashfreeMode = "sandbox" | "production";

  export interface CashfreeCheckout {
    checkout(options: { paymentSessionId: string }): void;
  }

  export function load(options: {
    mode: CashfreeMode;
  }): Promise<CashfreeCheckout | null>;
}
