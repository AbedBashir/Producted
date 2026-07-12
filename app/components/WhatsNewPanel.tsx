import { useState } from "react";

// Reflects what's actually shipped in Producted, kept current as features land.
const CHANGELOG = [
  {
    date: "Jul 12",
    title: "Real Shopify Billing",
    desc: "Upgrade and downgrade plans with real subscriptions — test charges on dev stores, live billing at launch.",
  },
  {
    date: "Jul 11",
    title: "Automation is live",
    desc: "Build rules that fire automatically when a product is created or updated, with test-before-saving.",
  },
  {
    date: "Jul 10",
    title: "AI command bar",
    desc: "Describe a change in plain English on Home and Producted parses it into a real rule you can run.",
  },
  {
    date: "Jul 9",
    title: "Catalog health checks",
    desc: "Home now flags missing titles, descriptions, SEO, images, and metafields across your whole store.",
  },
  {
    date: "Jul 8",
    title: "History & revert",
    desc: "Every bulk edit is logged with a real before/after diff — one click undoes it.",
  },
];

export default function WhatsNewPanel() {
  const [open, setOpen] = useState(false);

  return (
    <div className="ps-whatsnew-wrap">
      <button className="ps-whatsnew-btn" onClick={() => setOpen(!open)}>
        What's new
      </button>
      {open && (
        <div className="ps-whatsnew-dropdown">
          {CHANGELOG.map((item) => (
            <div className="ps-whatsnew-item" key={item.title}>
              <div className="ps-whatsnew-date">{item.date}</div>
              <div className="ps-whatsnew-title">{item.title}</div>
              <div className="ps-whatsnew-desc">{item.desc}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
