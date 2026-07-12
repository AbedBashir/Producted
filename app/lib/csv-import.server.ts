import { STATIC_FIELDS, type FieldOption } from "./rule-config";
import {
  PRODUCT_FIELDS_FRAGMENT,
  getCurrentValue,
  computeNewValue,
  applyFieldUpdate,
  isFieldExecutable,
  type ProductNode,
} from "./rule-execution";

// Import writes only to fields already executable elsewhere in the app (matches
// Rules' EXECUTABLE_FIELD_KEYS). Metafields and inventoryQuantity are exported for
// reference but intentionally not writable via import in this version.
const IMPORTABLE_KEYS = new Set(
  STATIC_FIELDS.filter((f) => f.key !== "inventoryQuantity").map((f) => f.key),
);

export const CSV_HEADER_TO_FIELD_KEY: Record<string, string> = {
  title: "title",
  vendor: "vendor",
  productType: "productType",
  tags: "tags",
  status: "status",
  seoTitle: "seoTitle",
  seoDescription: "seoDescription",
  price: "price",
  compareAtPrice: "compareAtPrice",
  sku: "sku",
  barcode: "barcode",
  weight: "weight",
};

export interface ImportRowDiff {
  id: string;
  title: string;
  changes: {
    fieldKey: string;
    fieldLabel: string;
    current: string;
    next: string;
  }[];
  error?: string;
}

export async function buildImportPreview(
  admin: any,
  rows: Record<string, string>[],
): Promise<{ diffs: ImportRowDiff[]; skippedColumns: string[] }> {
  const allFields: FieldOption[] = STATIC_FIELDS;
  const fieldByKey = new Map(allFields.map((f) => [f.key, f]));
  const fragment = PRODUCT_FIELDS_FRAGMENT(null);

  const csvHeaders = rows.length > 0 ? Object.keys(rows[0]) : [];
  const skippedColumns = csvHeaders.filter(
    (h) =>
      h !== "id" &&
      (!CSV_HEADER_TO_FIELD_KEY[h] ||
        !IMPORTABLE_KEYS.has(CSV_HEADER_TO_FIELD_KEY[h])),
  );

  const diffs: ImportRowDiff[] = [];

  for (const row of rows.slice(0, 500)) {
    const id = row.id;
    if (!id) continue;

    const response = await admin.graphql(
      `#graphql
        query GetProductForImport($id: ID!) {
          product(id: $id) { ${fragment} }
        }`,
      { variables: { id } },
    );
    const data = await response.json();
    const product = data.data?.product as ProductNode | null;

    if (!product) {
      diffs.push({
        id,
        title: row.title ?? id,
        changes: [],
        error: "Product not found — check the id column.",
      });
      continue;
    }

    const changes: ImportRowDiff["changes"] = [];
    for (const [header, value] of Object.entries(row)) {
      const fieldKey = CSV_HEADER_TO_FIELD_KEY[header];
      if (!fieldKey || !IMPORTABLE_KEYS.has(fieldKey)) continue;
      const field = fieldByKey.get(fieldKey)!;
      const current = getCurrentValue(product, field);
      if (current !== value && value !== "") {
        changes.push({
          fieldKey,
          fieldLabel: field.label,
          current,
          next: value,
        });
      }
    }

    diffs.push({ id, title: product.title, changes });
  }

  return { diffs, skippedColumns };
}

export async function executeImport(
  admin: any,
  rows: Record<string, string>[],
): Promise<{ updatedCount: number; errors: string[] }> {
  const allFields: FieldOption[] = STATIC_FIELDS;
  const fieldByKey = new Map(allFields.map((f) => [f.key, f]));
  const fragment = PRODUCT_FIELDS_FRAGMENT(null);

  let updatedCount = 0;
  const errors: string[] = [];

  for (const row of rows.slice(0, 500)) {
    const id = row.id;
    if (!id) continue;

    const response = await admin.graphql(
      `#graphql
        query GetProductForImportExecute($id: ID!) {
          product(id: $id) { ${fragment} }
        }`,
      { variables: { id } },
    );
    const data = await response.json();
    const product = data.data?.product as ProductNode | null;
    if (!product) {
      errors.push(`${id}: product not found`);
      continue;
    }

    for (const [header, value] of Object.entries(row)) {
      const fieldKey = CSV_HEADER_TO_FIELD_KEY[header];
      if (!fieldKey || !IMPORTABLE_KEYS.has(fieldKey) || !value) continue;
      const field = fieldByKey.get(fieldKey)!;
      if (!isFieldExecutable(field)) continue;

      const current = getCurrentValue(product, field);
      if (current === value) continue;

      const result = await applyFieldUpdate(admin, product, field, value);
      if (!result.success) {
        errors.push(`${product.title} — ${field.label}: ${result.error}`);
        continue;
      }
      updatedCount++;
    }
  }

  return { updatedCount, errors };
}
