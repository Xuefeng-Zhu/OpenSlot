"use client";

import { createContext, useContext, type ReactNode } from "react";
import {
  defaultDashboardDisplayPreferences,
  normalizeDashboardDisplayPreferences,
  type DashboardDisplayPreferences,
} from "@/lib/dashboard/display-preferences";

const DashboardDisplayPreferencesContext =
  createContext<DashboardDisplayPreferences>(
    defaultDashboardDisplayPreferences
  );

/** Makes the authenticated host's display preferences available to dashboard UI. */
export function DashboardDisplayPreferencesProvider({
  children,
  preferences,
}: {
  children: ReactNode;
  preferences: DashboardDisplayPreferences;
}) {
  return (
    <DashboardDisplayPreferencesContext.Provider
      value={normalizeDashboardDisplayPreferences(preferences)}
    >
      {children}
    </DashboardDisplayPreferencesContext.Provider>
  );
}

/** Reads the authenticated host's normalized dashboard display preferences. */
export function useDashboardDisplayPreferences(): DashboardDisplayPreferences {
  return useContext(DashboardDisplayPreferencesContext);
}
