import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const { runId } = (await request.json()) as { runId: string };

  const run = await db.editHistory.findUnique({ where: { id: runId } });
  if (!run || run.shop !== session.shop) {
    return { success: false, error: "Run not found" };
  }
  if (run.status === "reverted") {
    return { success: false, error: "Already reverted" };
  }

  const ruleChain = JSON.parse(run.ruleChain);
  const beforeState = JSON.parse(run.beforeState) as {
    id: string;
    title: string;
    value: string;
  }[];
  const field = ruleChain.field;

  let revertedCount = 0;
  const errors: string[] = [];

  for (const item of beforeState) {
    try {
      if (field.key.startsWith("mf:") && field.metafield) {
        const response = await admin.graphql(
          `#graphql
            mutation SetMetafield($metafields: [MetafieldsSetInput!]!) {
              metafieldsSet(metafields: $metafields) {
                userErrors { field message }
              }
            }`,
          {
            variables: {
              metafields: [
                {
                  ownerId: item.id,
                  namespace: field.metafield.namespace,
                  key: field.metafield.key,
                  type: field.metafield.type,
                  value: item.value,
                },
              ],
            },
          },
        );
        const result = await response.json();
        if (result.data?.metafieldsSet?.userErrors?.length > 0) {
          errors.push(
            `${item.title}: ${result.data.metafieldsSet.userErrors[0].message}`,
          );
          continue;
        }
      } else if (field.key === "price" || field.key === "compareAtPrice") {
        // Revert needs the variant id, which beforeState doesn't currently store —
        // re-fetch the product's first variant to target it.
        const productResp = await admin.graphql(
          `#graphql
            query GetVariant($id: ID!) {
              product(id: $id) {
                variants(first: 1) { edges { node { id } } }
              }
            }`,
          { variables: { id: item.id } },
        );
        const productData = await productResp.json();
        const variantId =
          productData.data?.product?.variants?.edges?.[0]?.node?.id;
        if (!variantId) continue;

        const response = await admin.graphql(
          `#graphql
            mutation RevertVariant($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
              productVariantsBulkUpdate(productId: $productId, variants: $variants) {
                userErrors { field message }
              }
            }`,
          {
            variables: {
              productId: item.id,
              variants: [
                {
                  id: variantId,
                  [field.key === "price" ? "price" : "compareAtPrice"]:
                    item.value,
                },
              ],
            },
          },
        );
        const result = await response.json();
        if (result.data?.productVariantsBulkUpdate?.userErrors?.length > 0) {
          errors.push(
            `${item.title}: ${result.data.productVariantsBulkUpdate.userErrors[0].message}`,
          );
          continue;
        }
      } else {
        const input: Record<string, any> = { id: item.id };
        if (field.key === "tags") {
          input.tags = item.value
            .split(",")
            .map((t: string) => t.trim())
            .filter(Boolean);
        } else if (field.key === "seoTitle") {
          input.seo = { title: item.value };
        } else if (field.key === "seoDescription") {
          input.seo = { description: item.value };
        } else {
          input[field.key] = item.value;
        }

        const response = await admin.graphql(
          `#graphql
            mutation RevertProduct($input: ProductInput!) {
              productUpdate(input: $input) {
                userErrors { field message }
              }
            }`,
          { variables: { input } },
        );
        const result = await response.json();
        if (result.data?.productUpdate?.userErrors?.length > 0) {
          errors.push(
            `${item.title}: ${result.data.productUpdate.userErrors[0].message}`,
          );
          continue;
        }
      }
      revertedCount++;
    } catch (err: any) {
      errors.push(`${item.title}: ${err.message ?? "unknown error"}`);
    }
  }

  await db.editHistory.update({
    where: { id: runId },
    data: { status: "reverted", revertedAt: new Date() },
  });

  return { success: errors.length === 0, revertedCount, errors };
};
