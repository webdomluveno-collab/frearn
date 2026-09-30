import { SectionHeading } from "@/components/fx/primitives";
import { Icon } from "@/components/fx/icon";

export default function SettingsPage() {
  return (
    <>
      <SectionHeading
        eyebrow="MAKE YOURSELF AT HOME"
        title="Your account, your way."
        description="The essentials of your Freearn account."
      />
      <section className="surface settings-panel">
        <div className="settings-panel-heading">
          <h2>Your account essentials</h2>
        </div>
        <div className="setting-action">
          <div>
            <strong>Email verification</strong>
            <p className="muted small">Confirm your address from the link we send you.</p>
          </div>
        </div>
        <div className="setting-action">
          <div>
            <strong>Sign-in methods</strong>
            <p className="muted small">Email and password. Google login is planned.</p>
          </div>
        </div>
        <div className="setting-action">
          <div>
            <strong>Delete account</strong>
            <p className="muted small">To close your account, contact support.</p>
          </div>
        </div>
        <div className="notice">
          <Icon name="lock" size={16} />
          <p>Use a unique password. Freearn staff will never ask for it.</p>
        </div>
      </section>
    </>
  );
}
