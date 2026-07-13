export const loader = async () => {
  return new Response(null);
};

export default function Privacy() {
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <title>Privacy Policy — Producted</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>{`
          body { font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 760px; margin: 60px auto; padding: 0 20px; color: #1a1f2b; line-height: 1.6; }
          h1 { font-size: 28px; margin-bottom: 4px; }
          .date { color: #888; font-size: 13px; margin-bottom: 32px; }
          h2 { font-size: 18px; margin-top: 32px; }
          ul { padding-left: 20px; }
        `}</style>
      </head>
      <body>
        <h1>Privacy Policy — Producted</h1>
        <p className="date">Last updated: July 2026</p>

        <p>
          Producted ("the App") is a Shopify application developed by FUSIONS
          ("we," "us," "our") that helps merchants bulk-edit and automate
          changes to their Shopify product catalog. This policy explains what
          data the App accesses, how it is used, and how it is protected.
        </p>

        <h2>Data we access</h2>
        <p>
          When you install Producted, we request access to the following Shopify
          data via API scopes:
        </p>
        <ul>
          <li>
            Products (read/write) — to read current product field values and
            apply the bulk edits you configure.
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

        <h2>Data we store</h2>
        <p>We store the following in our own database:</p>
        <ul>
          <li>Your shop's domain and current subscription plan</li>
          <li>Rules and automations you create, and their configuration</li>
          <li>
            A history log of bulk edits you run, including product IDs, field
            names, and before/after values, so changes can be reverted
          </li>
          <li>Basic usage counts for the Analytics feature</li>
          <li>
            If available from your Shopify session, the name or email of the
            staff member who ran a manual edit
          </li>
        </ul>
        <p>
          We do not sell, rent, or share this data with third parties for
          marketing purposes.
        </p>

        <h2>Third-party services</h2>
        <p>
          Producted's AI command bar feature sends the text you type to
          Anthropic's Claude API to interpret it into a structured rule. No
          Shopify data is included in that request beyond the instruction text
          you typed.
        </p>

        <h2>Data retention</h2>
        <p>
          Rule, automation, and history data is retained for as long as the App
          remains installed on your store. You may clear your edit history,
          automations, or saved templates at any time from the Settings page
          inside the App. If you uninstall the App, we delete your stored data.
        </p>

        <h2>Your rights</h2>
        <p>
          You may request a copy of the data we hold about your store, or
          request its deletion, by contacting us at the email below.
        </p>

        <h2>Security</h2>
        <p>
          Data is stored in a managed database with access restricted to the
          App's backend service. All communication between the App and Shopify
          uses HTTPS/TLS.
        </p>

        <h2>Contact</h2>
        <p>
          For privacy questions or data requests, contact: [insert your support
          email here]
        </p>
      </body>
    </html>
  );
}
