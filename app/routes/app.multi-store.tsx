import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import "../styles/shared.css";
import "../styles/rule-builder.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export default function MultiStore() {
  return (
    <div className="ps-canvas">
      <div className="ps-wrap">
        <div className="ps-header">
          <div>
            <h1>Multi-store</h1>
            <p>Run the same rule across every connected store at once.</p>
          </div>
          <span className="ps-eyebrow">FUSIONS · Producted</span>
        </div>

        <div className="rb-locked-banner" style={{ marginBottom: 32 }}>
          <span className="rb-crown-badge">🚧 Coming soon</span>
          <span className="rb-locked-text">
            Multi-store is in active development — connect several Shopify
            stores and fan a single rule out across all of them at once. Not
            available yet.
          </span>
        </div>

        <div className="ps-card">
          <div className="ps-card-body">
            <p className="ps-empty" style={{ padding: 24 }}>
              This feature isn't built yet. Check back after Producted launches.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
