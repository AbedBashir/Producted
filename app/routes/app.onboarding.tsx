import { useState } from "react";
import type { LoaderFunctionArgs } from "react-router";
import { Link } from "react-router";
import { authenticate } from "../shopify.server";
import "../styles/shared.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

const STEPS = [
  {
    title: "Pick a sample product",
    body: "We'll use one of your real products so you can see exactly how a bulk edit behaves — nothing changes yet.",
  },
  {
    title: "Run a demo rule",
    body: "Watch a rule chain from field to target, live, on that one product.",
  },
  {
    title: "See the diff",
    body: "Before and after, side by side. This is what every real run looks like before you confirm it.",
  },
];

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const isLast = step === STEPS.length - 1;

  return (
    <div
      className="ps-canvas"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ maxWidth: 480, width: "100%" }}>
        <div className="ps-steps">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`ps-step-dot ${i === step ? "active" : ""}`}
            />
          ))}
        </div>

        <div className="ps-card">
          <div
            className="ps-card-body"
            style={{ padding: 32, textAlign: "center", gap: 16 }}
          >
            <div style={{ fontSize: 20, fontWeight: 700 }}>
              {STEPS[step].title}
            </div>
            <div style={{ fontSize: 14, color: "#7c8aa5", lineHeight: 1.5 }}>
              {STEPS[step].body}
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              {step > 0 && (
                <button
                  className="ps-btn-outline"
                  style={{ flex: 1 }}
                  onClick={() => setStep(step - 1)}
                >
                  Back
                </button>
              )}
              {!isLast ? (
                <button
                  className="ps-btn-primary"
                  style={{ flex: 1 }}
                  onClick={() => setStep(step + 1)}
                >
                  Next
                </button>
              ) : (
                <Link to="/app/rules" style={{ flex: 1 }}>
                  <button className="ps-btn-primary" style={{ width: "100%" }}>
                    Start building
                  </button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
