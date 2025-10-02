"use client";

import { useEffect, useState } from "react";
import "@/styles/main.css";
import AdminHeader from "@/features/admin/components/AdminHeader";
import StatsBar from "@/features/admin/components/StatsBar";
import AddTelegramAccountWizard from "@/features/admin/components/AddTelegramAccountWizard";
import LiveNotifications from "@/features/admin/components/LiveNotifications";
import UserInspector from "@/features/admin/components/UserInspector";
import BotAccessSection from "@/features/admin/components/BotAccessSection";
import UsersList from "@/features/admin/components/UsersList";
import TgAccountsSection from "@/features/admin/components/TgAccounts/TgAccountsSection";
import type { User } from "@/types";
import { fetchAccounts } from "@/features/admin/services/accounts";
import { fetchAllTgAccounts } from "@/features/admin/services/telegram";

export default function Admin() {
  const [accounts, setAccounts] = useState<User[]>([]);
  const [tgTotal, setTgTotal] = useState(0);

  const reloadAccountsOnly = async () => {
    try {
      const list = await fetchAccounts();
      setAccounts(list);
    } catch {
      setAccounts([]);
    }
  };

  const reloadTgOnly = async () => {
    try {
      const list = await fetchAllTgAccounts();
      setTgTotal(list.length);
    } catch {
      setTgTotal(0);
    }
  };

  const reloadAll = async () => {
    await Promise.all([reloadAccountsOnly(), reloadTgOnly()]);
  };

  useEffect(() => {
    reloadAll();
  }, []);

  return (
    <div className="min-h-screen dashboard-container">
      <div className="background-effects">
        <div className="gradient-orb orb-1" />
        <div className="gradient-orb orb-2" />
        <div className="gradient-orb orb-3" />
      </div>

      <div className="relative z-10">
        <AdminHeader />
        <main className="container mx-auto px-6 py-8">
          <StatsBar users={accounts.length} tg={tgTotal} />

          <AddTelegramAccountWizard onAdded={reloadAll} />

          <section className="mt-8">
            <LiveNotifications />
          </section>

          <section className="mt-8">
            <BotAccessSection />
          </section>

          <section className="mt-8">
            <UserInspector />
          </section>

          <section className="mt-8">
            <UsersList accounts={accounts} onChange={setAccounts} />
          </section>

          <TgAccountsSection />
        </main>
      </div>
    </div>
  );
}
