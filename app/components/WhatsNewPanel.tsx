import { useState } from "react";

const CHANGELOG = [
  {
    date: "Jul 9",
    title: "Product browser added",
    desc: "Search and bulk-select products directly inside Producted.",
  },
  {
    date: "Jul 8",
    title: "Automation builder (preview)",
    desc: "Trigger → rule → refine, coming to Pro plans.",
  },
  {
    date: "Jul 5",
    title: "Metafields in the field dropdown",
    desc: "Your store's real metafield definitions now show up automatically.",
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
