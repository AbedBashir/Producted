import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return null;
};

export default function Index() {
  return (
    <div
      style={{
        fontFamily: "-apple-system, Helvetica, Arial, sans-serif",
        textAlign: "center",
        padding: "80px 20px",
        color: "#1a1f2b",
      }}
    >
      <h1 style={{ fontSize: 24 }}>Producted</h1>
      <p style={{ color: "#7c8aa5" }}>
        This app is installed from the Shopify App Store.
      </p>
    </div>
  );
}
