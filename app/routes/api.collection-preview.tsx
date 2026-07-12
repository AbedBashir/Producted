import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const ids = url.searchParams.get("ids")?.split(",").filter(Boolean) ?? [];

  if (ids.length === 0) {
    return { items: [], totalCount: 0 };
  }

  const results = await Promise.all(
    ids.map((id) =>
      admin
        .graphql(
          `#graphql
            query GetCollectionProducts($id: ID!) {
              collection(id: $id) {
                productsCount {
                  count
                }
                products(first: 6) {
                  edges {
                    node {
                      id
                      title
                      featuredImage {
                        url
                      }
                    }
                  }
                }
              }
            }`,
          { variables: { id } },
        )
        .then((r) => r.json()),
    ),
  );

  let totalCount = 0;
  const items: { id: string; title: string; imageUrl?: string }[] = [];

  for (const result of results) {
    const collection = result.data?.collection;
    if (!collection) continue;
    totalCount += collection.productsCount?.count ?? 0;
    for (const edge of collection.products.edges) {
      if (items.length < 6) {
        items.push({
          id: edge.node.id,
          title: edge.node.title,
          imageUrl: edge.node.featuredImage?.url,
        });
      }
    }
  }

  return { items, totalCount };
};
