"use client";

import { Button } from "@/components/fx/primitives";
import { SectionHeading } from "@/components/fx/primitives";

export default function ProfilePage() {
  return (
    <>
      <SectionHeading
        eyebrow="MAKE YOURSELF AT HOME"
        title="A little about you."
        description="Only the details needed for matching. Additional provider questions can be added here later."
      />
      <section className="surface settings-panel">
        <div className="settings-panel-heading">
          <h2>Your profile details</h2>
          <p className="muted small">Used to match relevant opportunities.</p>
        </div>
        <form className="form-stack" onSubmit={(e) => e.preventDefault()}>
          <div className="field">
            <label htmlFor="p-country">Country</label>
            <input id="p-country" placeholder="Country" autoComplete="country-name" />
          </div>
          <div className="field">
            <label htmlFor="p-dob">Date of birth</label>
            <input id="p-dob" type="date" autoComplete="bday" />
          </div>
          <div className="field">
            <label htmlFor="p-gender">Gender</label>
            <input id="p-gender" placeholder="Female / Male / Non-binary / Prefer not to say" />
          </div>
          <div className="field">
            <label htmlFor="p-employment">Employment status</label>
            <input id="p-employment" placeholder="e.g. Employed, Student" />
          </div>
          <div className="field">
            <label htmlFor="p-education">Education</label>
            <input id="p-education" placeholder="e.g. Bachelor's degree" />
          </div>
          <div className="field">
            <label htmlFor="p-household">Household size</label>
            <input id="p-household" type="number" min={1} placeholder="e.g. 3" />
          </div>
          <Button type="submit">Save profile</Button>
        </form>
      </section>
    </>
  );
}
