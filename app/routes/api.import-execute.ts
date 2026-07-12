import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { getCreditStatus, spendCredit } from "../lib/credits.server";
import { planMeetsMinimum, CSV_MIN_PLAN } from "../lib/plans";
import { executeImport } from "../lib/csv-import.server";
import { getActingUserName } from "../lib/attribution.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  const credits = await getCreditStatus(session.shop);
  if (!planMeetsMinimum(credits.plan, CSV_MIN_PLAN)) {
    return {
      success: false,
      updatedCount: 0,
      errors: ["CSV import requires the Pro plan or higher."],
    };
  }
  if (credits.remaining <= 0) {
    return {
      success: false,
      updatedCount: 0,
      errors: ["Out of credits this month — upgrade to keep importing."],
    };
  }

  const { rows } = (await request.json()) as { rows: Record<string, string>[] };
  const { updatedCount, errors } = await executeImport(admin, rows);

  await db.editHistory.create({
    data: {
      shop: session.shop,
      ruleChain: JSON.stringify({ importedCsv: true, rowCount: rows.length }),
      targetType: "products",
      targetCount: updatedCount,
      status:
        errors.length === 0
          ? "completed"
          : updatedCount > 0
            ? "completed"
            : "failed",
      beforeState: JSON.stringify([]),
      afterState: JSON.stringify([]),
      runByName: getActingUserName(session),
    },
  });

  if (updatedCount > 0) {
    await spendCredit(session.shop);
  }

  return { success: errors.length === 0, updatedCount, errors };
};
