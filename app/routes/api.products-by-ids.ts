import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const ids = url.searchParams.get("ids")?.split(",").filter(Boolean) ?? [];

  if (ids.length === 0) {
    return { items: [] };
  }

  const response = await admin.graphql(
    `#graphql
      query GetProductsByIds($ids: [ID!]!) {
        nodes(ids: $ids) {
          ... on Product {
            id
            title
            featuredImage { url }
          }
        }
      }`,
    { variables: { ids } },
  );
  const data = await response.json();

  const items = (data.data.nodes ?? []).filter(Boolean).map((n: any) => ({
    id: n.id,
    title: n.title,
    imageUrl: n.featuredImage?.url,
  }));

  return { items };
};
