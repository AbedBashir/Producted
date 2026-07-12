import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { getCreditStatus } from "../lib/credits.server";
import { planMeetsMinimum, CSV_MIN_PLAN } from "../lib/plans";
import { generateProductsCsv } from "../lib/csv-export.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  const credits = await getCreditStatus(session.shop);
  if (!planMeetsMinimum(credits.plan, CSV_MIN_PLAN)) {
    return new Response("CSV export requires the Pro plan or higher.", {
      status: 403,
    });
  }

  const metafieldsResponse = await admin.graphql(
    `#graphql
      query GetProductMetafieldDefinitions {
        metafieldDefinitions(ownerType: PRODUCT, first: 100) {
          edges { node { namespace key name type { name } } }
        }
      }`,
  );
  const metafieldsData = await metafieldsResponse.json();
  const metafieldDefs = metafieldsData.data.metafieldDefinitions.edges.map(
    (e: any) => e.node,
  );

  const { csv } = await generateProductsCsv(admin, metafieldDefs);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="producted-export-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
};
