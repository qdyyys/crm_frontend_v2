import { Users, Send } from "lucide-react";

export default function StatsBar({ users, tg }: { users: number; tg: number }) {
  return (
    <section className="stats-grid mb-8">
      <div className="stat-card">
        <div className="stat-icon">
          <Users className="w-6 h-6" />
        </div>
        <div>
          <p className="stat-number">{users}</p>
          <p className="stat-label">Пользователи</p>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon">
          <Send className="w-6 h-6" />
        </div>
        <div>
          <p className="stat-number">{tg}</p>
          <p className="stat-label">Телеграм аккаунты</p>
        </div>
      </div>
    </section>
  );
}
