import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { getCreditStatus } from "../lib/credits.server";
import { planMeetsMinimum, CSV_MIN_PLAN } from "../lib/plans";
import { buildImportPreview } from "../lib/csv-import.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  const credits = await getCreditStatus(session.shop);
  if (!planMeetsMinimum(credits.plan, CSV_MIN_PLAN)) {
    return {
      success: false,
      error: "CSV import requires the Pro plan or higher.",
    };
  }

  const { rows } = (await request.json()) as { rows: Record<string, string>[] };
  if (!rows || rows.length === 0) {
    return { success: false, error: "No rows found in that file." };
  }

  const { diffs, skippedColumns } = await buildImportPreview(admin, rows);
  return { success: true, diffs, skippedColumns };
};
