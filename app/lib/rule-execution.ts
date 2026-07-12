import type { FieldOption, ActionKey, RuleCondition } from "./rule-config";

export interface ProductNode {
  id: string;
  title: string;
  vendor: string;
  productType: string;
  tags: string[];
  status: string;
  totalInventory: number;
  seo: { title: string | null; description: string | null };
  variants: {
    edges: {
      node: {
        id: string;
        price: string;
        compareAtPrice: string | null;
        sku: string | null;
        barcode: string | null;
        inventoryItem?: {
          measurement?: {
            weight?: { value: number; unit: string } | null;
          } | null;
        } | null;
      };
    }[];
  };
  metafieldValue?: { value: string } | null;
}

const MAX_PRODUCTS_PER_RUN = 1000;
const PAGE_SIZE = 250;

export const PRODUCT_FIELDS_FRAGMENT = (
  includeMetafield: { namespace: string; key: string } | null,
) => `
  id
  title
  vendor
  productType
  tags
  status
  totalInventory
  seo { title description }
  variants(first: 10) {
    edges {
      node {
        id
        price
        compareAtPrice
        sku
        barcode
        inventoryItem { measurement { weight { value unit } } }
      }
    }
  }
  ${
    includeMetafield
      ? `metafieldValue: metafield(namespace: "${includeMetafield.namespace}", key: "${includeMetafield.key}") { value }`
      : ""
  }
`;

interface PaginatedResult {
  products: ProductNode[];
  hitCap: boolean;
}

export async function fetchAllProducts(
  admin: any,
  fragment: string,
): Promise<PaginatedResult> {
  let products: ProductNode[] = [];
  let cursor: string | null = null;
  let hasNextPage = true;
  let hitCap = false;

  while (hasNextPage && products.length < MAX_PRODUCTS_PER_RUN) {
    const response = await admin.graphql(
      `#graphql
        query GetAllProductsPaginated($first: Int!, $after: String) {
          products(first: $first, after: $after) {
            edges { cursor node { ${fragment} } }
            pageInfo { hasNextPage }
          }
        }`,
      { variables: { first: PAGE_SIZE, after: cursor } },
    );
    const data = await response.json();
    const edges = data.data.products.edges;
    products.push(...edges.map((e: any) => e.node));
    hasNextPage = data.data.products.pageInfo.hasNextPage;
    cursor = edges.length > 0 ? edges[edges.length - 1].cursor : null;

    if (products.length >= MAX_PRODUCTS_PER_RUN) {
      hitCap = hasNextPage;
      break;
    }
  }

  return { products: products.slice(0, MAX_PRODUCTS_PER_RUN), hitCap };
}

export async function fetchCollectionProducts(
  admin: any,
  collectionIds: string[],
  fragment: string,
): Promise<PaginatedResult> {
  let allProducts: ProductNode[] = [];
  let hitCap = false;
  const seen = new Set<string>();

  for (const collectionId of collectionIds) {
    let cursor: string | null = null;
    let hasNextPage = true;

    while (hasNextPage && allProducts.length < MAX_PRODUCTS_PER_RUN) {
      const response = await admin.graphql(
        `#graphql
          query GetCollectionProductsPaginated($id: ID!, $first: Int!, $after: String) {
            collection(id: $id) {
              products(first: $first, after: $after) {
                edges { cursor node { ${fragment} } }
                pageInfo { hasNextPage }
              }
            }
          }`,
        { variables: { id: collectionId, first: PAGE_SIZE, after: cursor } },
      );
      const data = await response.json();
      const edges = data.data.collection?.products?.edges ?? [];

      for (const edge of edges) {
        if (!seen.has(edge.node.id)) {
          seen.add(edge.node.id);
          allProducts.push(edge.node);
        }
      }

      hasNextPage =
        data.data.collection?.products?.pageInfo?.hasNextPage ?? false;
      cursor = edges.length > 0 ? edges[edges.length - 1].cursor : null;

      if (allProducts.length >= MAX_PRODUCTS_PER_RUN) {
        hitCap = hasNextPage;
        break;
      }
    }
  }

  return { products: allProducts.slice(0, MAX_PRODUCTS_PER_RUN), hitCap };
}

export function conditionsMatch(
  product: ProductNode,
  conditions: RuleCondition[],
): boolean {
  return conditions.every((cond) => {
    let actual: string | number = "";
    if (cond.field === "vendor") actual = product.vendor ?? "";
    else if (cond.field === "productType") actual = product.productType ?? "";
    else if (cond.field === "status") actual = product.status ?? "";
    else if (cond.field === "tags") actual = (product.tags ?? []).join(", ");
    else if (cond.field === "inventoryQty")
      actual = product.totalInventory ?? 0;

    const expected = cond.value;

    switch (cond.operator) {
      case "equals":
        return String(actual).toLowerCase() === expected.toLowerCase();
      case "notEquals":
        return String(actual).toLowerCase() !== expected.toLowerCase();
      case "contains":
        return String(actual).toLowerCase().includes(expected.toLowerCase());
      case "greaterThan":
        return Number(actual) > Number(expected);
      case "lessThan":
        return Number(actual) < Number(expected);
      default:
        return true;
    }
  });
}

export function getCurrentValue(
  product: ProductNode,
  field: FieldOption,
): string {
  const firstVariant = product.variants?.edges?.[0]?.node;
  switch (field.key) {
    case "title":
      return product.title ?? "";
    case "vendor":
      return product.vendor ?? "";
    case "productType":
      return product.productType ?? "";
    case "tags":
      return (product.tags ?? []).join(", ");
    case "status":
      return product.status ?? "";
    case "seoTitle":
      return product.seo?.title ?? "";
    case "seoDescription":
      return product.seo?.description ?? "";
    case "price":
      return firstVariant?.price ?? "";
    case "compareAtPrice":
      return firstVariant?.compareAtPrice ?? "";
    case "sku":
      return firstVariant?.sku ?? "";
    case "barcode":
      return firstVariant?.barcode ?? "";
    case "weight":
      return String(
        firstVariant?.inventoryItem?.measurement?.weight?.value ?? "",
      );
    default:
      if (field.key.startsWith("mf:"))
        return product.metafieldValue?.value ?? "";
      return "";
  }
}

interface ComputeOptions {
  findValue?: string;
  incrementMode?: "flat" | "percent";
}

export function computeNewValue(
  field: FieldOption,
  action: ActionKey,
  currentValue: string,
  inputValue: string,
  options: ComputeOptions = {},
): string {
  const { findValue = "", incrementMode = "flat" } = options;

  if (action === "toggle") {
    if (field.key === "status") {
      return currentValue === "ACTIVE" ? "DRAFT" : "ACTIVE";
    }
    if (field.valueInputType === "boolean-select") {
      return currentValue === "true" ? "false" : "true";
    }
    return inputValue;
  }

  if (action === "replace") {
    if (!findValue) return currentValue;

    if (field.key === "tags") {
      const existing = currentValue
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const idx = existing.findIndex(
        (t) => t.toLowerCase() === findValue.toLowerCase(),
      );
      if (idx === -1) return currentValue;
      existing[idx] = inputValue;
      return existing.join(", ");
    }

    if (!currentValue.toLowerCase().includes(findValue.toLowerCase()))
      return currentValue;
    const escaped = findValue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(escaped, "gi");
    return currentValue.replace(re, inputValue);
  }

  if (action === "append" && field.key === "tags") {
    const existing = currentValue
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const incoming = inputValue
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const merged = Array.from(new Set([...existing, ...incoming]));
    return merged.join(", ");
  }

  if (action === "increment") {
    const current = parseFloat(currentValue) || 0;
    const delta = parseFloat(inputValue) || 0;
    if (incrementMode === "percent") {
      return (current * (1 + delta / 100)).toFixed(2);
    }
    return (current + delta).toFixed(2);
  }

  return inputValue;
}

export const EXECUTABLE_FIELD_KEYS = new Set([
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
]);

export function isFieldExecutable(field: FieldOption): boolean {
  if (field.key.startsWith("mf:")) return true;
  return EXECUTABLE_FIELD_KEYS.has(field.key);
}

// Applies a single field change to a single product. Shared by manual execute (Rules)
// and automated execute (webhook-triggered), so both go through identical mutation logic.
export async function applyFieldUpdate(
  admin: any,
  product: ProductNode,
  field: FieldOption,
  newValue: string,
): Promise<{ success: boolean; error?: string }> {
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
                ownerId: product.id,
                namespace: field.metafield.namespace,
                key: field.metafield.key,
                type: field.metafield.type,
                value: newValue,
              },
            ],
          },
        },
      );
      const result = await response.json();
      const userErrors = result.data?.metafieldsSet?.userErrors ?? [];
      if (userErrors.length > 0)
        return { success: false, error: userErrors[0].message };
      return { success: true };
    }

    if (
      ["price", "compareAtPrice", "sku", "barcode", "weight"].includes(
        field.key,
      )
    ) {
      const variantEdges = product.variants.edges;
      if (variantEdges.length === 0)
        return { success: false, error: "No variants" };

      const existingUnit =
        variantEdges[0]?.node?.inventoryItem?.measurement?.weight?.unit ??
        "POUNDS";

      const variantInput = variantEdges.map(({ node }) => {
        const input: Record<string, any> = { id: node.id };
        if (field.key === "price") input.price = newValue;
        else if (field.key === "compareAtPrice")
          input.compareAtPrice = newValue;
        else if (field.key === "sku") input.inventoryItem = { sku: newValue };
        else if (field.key === "barcode") input.barcode = newValue;
        else if (field.key === "weight")
          input.inventoryItem = {
            measurement: {
              weight: { value: parseFloat(newValue) || 0, unit: existingUnit },
            },
          };
        return input;
      });

      const response = await admin.graphql(
        `#graphql
          mutation UpdateVariants($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
            productVariantsBulkUpdate(productId: $productId, variants: $variants) {
              userErrors { field message }
            }
          }`,
        { variables: { productId: product.id, variants: variantInput } },
      );
      const result = await response.json();
      const userErrors =
        result.data?.productVariantsBulkUpdate?.userErrors ?? [];
      if (userErrors.length > 0)
        return { success: false, error: userErrors[0].message };
      return { success: true };
    }

    const input: Record<string, any> = { id: product.id };
    if (field.key === "tags") {
      input.tags = newValue
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
    } else if (field.key === "seoTitle" || field.key === "seoDescription") {
      input.seo = {
        title: field.key === "seoTitle" ? newValue : product.seo?.title,
        description:
          field.key === "seoDescription" ? newValue : product.seo?.description,
      };
    } else {
      input[field.key] = newValue;
    }

    const response = await admin.graphql(
      `#graphql
        mutation UpdateProduct($input: ProductInput!) {
          productUpdate(input: $input) {
            userErrors { field message }
          }
        }`,
      { variables: { input } },
    );
    const result = await response.json();
    const userErrors = result.data?.productUpdate?.userErrors ?? [];
    if (userErrors.length > 0)
      return { success: false, error: userErrors[0].message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message ?? "unknown error" };
  }
}
