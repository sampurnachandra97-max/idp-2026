import Link from "next/link";
import { Logo } from "@/components/Logo";
import { SoilField } from "@/components/SoilField";
import "./landing.css";

export default function Landing() {
  return (
    <main className="landing">
      <div className="landing-copy">
        <div className="landing-logo">
          <Logo />
        </div>
        <h1>
          Read the Ground
          <br />
          Before You
          <br />
          Plant It
        </h1>

        <div className="landing-foot">
          <p className="landing-lead">
            Machine learning that turns a routine soil test into clear estimates, early stress warnings and
            crops that suit the field.
          </p>
          <div className="landing-actions">
            <Link className="landing-cta" href="/login">Sign in</Link>
            <Link className="landing-secondary" href="/login?mode=signup">Create account</Link>
          </div>
        </div>
      </div>
      <SoilField />
    </main>
  );
}
