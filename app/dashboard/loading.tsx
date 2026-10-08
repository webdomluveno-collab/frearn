import { Icon } from "@/components/fx/icon";

export default function DashboardLoading() {
  return (
    <section className="dashboard-loading" role="status" aria-label="Loading your Freearn account" aria-busy="true">
      <span className="eyebrow"><Icon name="spark" size={18} />A LITTLE MOMENT</span>
      <h1>Your next little win is loading.</h1>
      <p className="muted">Getting your account ready.</p>
      <div className="loading-composition" aria-hidden="true"><div className="skeleton loading-balance" /><div className="loading-side"><div className="skeleton" /><div className="skeleton" /></div></div>
      <div className="loading-cards" aria-hidden="true"><div className="skeleton" /><div className="skeleton" /></div>
    </section>
  );
}
