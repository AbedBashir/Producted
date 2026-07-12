import {
  STATIC_FIELDS,
  metafieldToFieldOption,
  type FieldOption,
} from "./rule-config";
import { toCsv } from "./csv-utils";

const EXPORT_CAP = 1000;

interface MetafieldDef {
  namespace: string;
  key: string;
  name: string;
  type: { name: string };
}

export async function generateProductsCsv(
  admin: any,
  metafieldDefs: MetafieldDef[],
): Promise<{ csv: string; count: number; hitCap: boolean }> {
  const metafieldKeys = metafieldDefs.map((d) => `${d.namespace}.${d.key}`);

  const staticHeaders = [
    "id",
    "title",
    "vendor",
    "productType",
    "tags",
    "status",
    "seoTitle",
    "seoDescription",
    "price",
    "compareAtPrice",
    "sku",
    "barcode",
    "weight",
    "inventoryQuantity",
  ];
  const metafieldHeaders = metafieldDefs.map(
    (d) => `mf:${d.namespace}.${d.key}`,
  );
  const headers = [...staticHeaders, ...metafieldHeaders];

  const rows: string[][] = [headers];

  let cursor: string | null = null;
  let hasNext = true;
  let fetched = 0;
  let hitCap = false;

  while (hasNext && fetched < EXPORT_CAP) {
    const response = await admin.graphql(
      `#graphql
        query ExportProducts($cursor: String, $keys: [String!]) {
          products(first: 100, after: $cursor) {
            edges {
              cursor
              node {
                id
                title
                vendor
                productType
                tags
                status
                seo { title description }
                variants(first: 1) {
                  edges {
                    node {
                      price
                      compareAtPrice
                      sku
                      barcode
                      inventoryQuantity
                      inventoryItem { measurement { weight { value unit } } }
                    }
                  }
                }
                metafields(keys: $keys, first: 50) {
                  edges { node { namespace key value } }
                }
              }
            }
            pageInfo { hasNextPage }
          }
        }`,
      { variables: { cursor, keys: metafieldKeys } },
    );
    const data = await response.json();
    const edges = data.data.products.edges;

    for (const edge of edges) {
      if (fetched >= EXPORT_CAP) {
        hitCap = true;
        break;
      }
      const p = edge.node;
      const variant = p.variants.edges[0]?.node;
      const metafieldMap = new Map(
        (p.metafields.edges ?? []).map((e: any) => [
          `${e.node.namespace}.${e.node.key}`,
          e.node.value,
        ]),
      );

      const row = [
        p.id,
        p.title ?? "",
        p.vendor ?? "",
        p.productType ?? "",
        (p.tags ?? []).join(", "),
        p.status ?? "",
        p.seo?.title ?? "",
        p.seo?.description ?? "",
        variant?.price ?? "",
        variant?.compareAtPrice ?? "",
        variant?.sku ?? "",
        variant?.barcode ?? "",
        variant?.inventoryItem?.measurement?.weight?.value?.toString() ?? "",
        variant?.inventoryQuantity?.toString() ?? "",
        ...metafieldDefs.map(
          (d) => (metafieldMap.get(`${d.namespace}.${d.key}`) as string) ?? "",
        ),
      ];
      rows.push(row);
      fetched++;
    }

    hasNext = data.data.products.pageInfo.hasNextPage && !hitCap;
    cursor = edges[edges.length - 1]?.cursor ?? null;
  }

  return { csv: toCsv(rows), count: fetched, hitCap };
}
