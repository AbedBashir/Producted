import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useFetcher, useNavigate } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import "../styles/shared.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  await db.appSettings.upsert({
    where: { shop: session.shop },
    update: { onboardingCompleted: true },
    create: { shop: session.shop, onboardingCompleted: true },
  });
  return { success: true };
};

const STEPS = [
  {
    title: "Chain a rule",
    body: "Pick a field, an action, and a value on the Rules page — set a price, tag a product, fill in a metafield. It works like a sentence: 'Set Vendor to Nike.'",
  },
  {
    title: "Preview before anything changes",
    body: "Every rule shows you exactly which products it'll touch and what changes, side by side, before you confirm — nothing runs blind.",
  },
  {
    title: "Undo if something's wrong",
    body: "Every run is logged in History with a real before/after diff. One click reverts it if you change your mind.",
  },
];

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();
  const completeFetcher = useFetcher();
  const isLast = step === STEPS.length - 1;

  const handleFinish = () => {
    completeFetcher.submit({}, { method: "POST", action: "/app/onboarding" });
    navigate("/app/rules");
  };

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
                <button
                  className="ps-btn-primary"
                  style={{ flex: 1 }}
                  onClick={handleFinish}
                >
                  Start building
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
