"use client";
import type { ReactNode } from "react";
import { NotificationsProvider } from "@/lib/notifications/provider";
import { FavoritesProvider } from "@/lib/favorites/provider";
import { PWARegister } from "./PWARegister";
import { Splash } from "./Splash";

/** Client provider boundary mounted once at the root. */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <NotificationsProvider>
      <FavoritesProvider>
        <PWARegister />
        <Splash />
        {children}
      </FavoritesProvider>
    </NotificationsProvider>
  );
}
