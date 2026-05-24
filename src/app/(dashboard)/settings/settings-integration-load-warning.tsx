import { type ReactNode } from "react";

export function IntegrationLoadWarning({ children }: { children: ReactNode }) {
  return (
    <div
      className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
      role="alert"
    >
      {children}
    </div>
  );
}
