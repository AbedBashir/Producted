import "../styles/shared.css";

export default function Privacy() {
  return (
    <div
      style={{
        fontFamily: "-apple-system, Helvetica, Arial, sans-serif",
        maxWidth: 760,
        margin: "60px auto",
        padding: "0 20px",
        color: "#1a1f2b",
        lineHeight: 1.6,
      }}
    >
      <h1 style={{ fontSize: 28, marginBottom: 4 }}>
        Privacy Policy — Producted
      </h1>
      <p style={{ color: "#888", fontSize: 13, marginBottom: 32 }}>
        Last updated: July 2026
      </p>

      <p>
        Producted ("the App") is a Shopify application developed by FUSIONS
        ("we," "us," "our") that helps merchants bulk-edit and automate changes
        to their Shopify product catalog. This policy explains what data the App
        accesses, how it is used, and how it is protected.
      </p>

      <h2 style={{ fontSize: 18, marginTop: 32 }}>Data we access</h2>
      <p>
        When you install Producted, we request access to the following Shopify
        data via API scopes:
      </p>
      <ul style={{ paddingLeft: 20 }}>
        <li>
          Products (read/write) — to read current product field values and apply
          the bulk edits you configure.
        </li>
        <li>
          Metaobjects and metaobject definitions (read/write) — to support
          metafield-based rules and conditions.
        </li>
      </ul>
      <p>
        Producted does not request or access customer data, order data, or any
        personally identifiable information about your shoppers.
      </p>

      <h2 style={{ fontSize: 18, marginTop: 32 }}>Data we store</h2>
      <p>We store the following in our own database:</p>
      <ul style={{ paddingLeft: 20 }}>
        <li>Your shop's domain and current subscription plan</li>
        <li>Rules and automations you create, and their configuration</li>
        <li>
          A history log of bulk edits you run, including product IDs, field
          names, and before/after values, so changes can be reverted
        </li>
        <li>Basic usage counts for the Analytics feature</li>
        <li>
          If available from your Shopify session, the name or email of the staff
          member who ran a manual edit
        </li>
      </ul>
      <p>
        We do not sell, rent, or share this data with third parties for
        marketing purposes.
      </p>

      <h2 style={{ fontSize: 18, marginTop: 32 }}>Third-party services</h2>
      <p>
        Producted's AI command bar feature sends the text you type to
        Anthropic's Claude API to interpret it into a structured rule. No
        Shopify data is included in that request beyond the instruction text you
        typed.
      </p>

      <h2 style={{ fontSize: 18, marginTop: 32 }}>Data retention</h2>
      <p>
        Rule, automation, and history data is retained for as long as the App
        remains installed on your store. You may clear your edit history,
        automations, or saved templates at any time from the Settings page
        inside the App. If you uninstall the App, we delete your stored data.
      </p>

      <h2 style={{ fontSize: 18, marginTop: 32 }}>Your rights</h2>
      <p>
        You may request a copy of the data we hold about your store, or request
        its deletion, by contacting us at the email below.
      </p>

      <h2 style={{ fontSize: 18, marginTop: 32 }}>Security</h2>
      <p>
        Data is stored in a managed database with access restricted to the App's
        backend service. All communication between the App and Shopify uses
        HTTPS/TLS.
      </p>

      <h2 style={{ fontSize: 18, marginTop: 32 }}>Contact</h2>
      <p>
        For privacy questions or data requests, contact: support@fusions.dev
      </p>
    </div>
  );
}
