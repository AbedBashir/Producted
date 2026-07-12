import db from "../db.server";
import { getCreditStatus, spendCredit } from "./credits.server";
import {
  PRODUCT_FIELDS_FRAGMENT,
  conditionsMatch,
  getCurrentValue,
  computeNewValue,
  applyFieldUpdate,
  isFieldExecutable,
  type ProductNode,
} from "./rule-execution";
import type { FieldOption, ActionKey, RuleCondition } from "./rule-config";

export interface RuleStep {
  field: FieldOption;
  action: ActionKey;
  value: string;
  findValue?: string;
  incrementMode?: "flat" | "percent";
}

export async function evaluateAutomationsForProduct(
  admin: any,
  shop: string,
  productGid: string,
  triggerEvent: "created" | "updated",
) {
  const settings = await db.appSettings.findUnique({ where: { shop } });
  if (settings?.automationsPaused) return; // global safety switch — skip everything

  const automations = await db.automation.findMany({
    where: { shop, triggerEvent, active: true, paused: false },
  });

  if (automations.length === 0) return;

  for (const automation of automations) {
    const ruleSteps = JSON.parse(automation.ruleChain) as RuleStep[];
    const conditions = JSON.parse(automation.conditions) as RuleCondition[];

    const executableSteps = ruleSteps.filter((s) => isFieldExecutable(s.field));
    if (executableSteps.length === 0) continue;

    const credits = await getCreditStatus(shop);
    if (credits.remaining <= 0) {
      await db.automation.update({
        where: { id: automation.id },
        data: { paused: true, pausedReason: "out_of_credits" },
      });
      continue;
    }

    // Fetch the product once with the widest field coverage needed (metafield of the first metafield step, if any).
    const metafieldStep = executableSteps.find((s) =>
      s.field.key.startsWith("mf:"),
    );
    const fragment = PRODUCT_FIELDS_FRAGMENT(
      metafieldStep?.field.metafield ?? null,
    );

    const response = await admin.graphql(
      `#graphql
        query GetProductForAutomation($id: ID!) {
          product(id: $id) { ${fragment} }
        }`,
      { variables: { id: productGid } },
    );
    const data = await response.json();
    const product = data.data?.product as ProductNode | null;
    if (!product) continue;

    if (!conditionsMatch(product, conditions)) continue;

    const changes: { field: string; before: string; after: string }[] = [];
    let anySucceeded = false;
    let anyFailed = false;

    for (const step of executableSteps) {
      const currentValue = getCurrentValue(product, step.field);
      const newValue = computeNewValue(
        step.field,
        step.action,
        currentValue,
        step.value,
        {
          findValue: step.findValue,
          incrementMode: step.incrementMode,
        },
      );
      if (currentValue === newValue) continue;

      const result = await applyFieldUpdate(
        admin,
        product,
        step.field,
        newValue,
      );
      if (result.success) {
        anySucceeded = true;
        changes.push({
          field: step.field.label,
          before: currentValue,
          after: newValue,
        });
      } else {
        anyFailed = true;
      }
    }

    if (changes.length === 0) continue; // nothing actually changed, skip logging/charging

    await db.editHistory.create({
      data: {
        shop,
        runByName: "Automation",
        ruleChain: JSON.stringify({
          rules: ruleSteps,
          conditions,
          automationId: automation.id,
          automationName: automation.name,
        }),
        targetType: "products",
        targetCount: anySucceeded ? 1 : 0,
        status: anyFailed && !anySucceeded ? "failed" : "completed",
        beforeState: JSON.stringify(
          changes.map((c) => ({
            id: product.id,
            title: product.title,
            value: c.before,
          })),
        ),
        afterState: JSON.stringify(
          changes.map((c) => ({
            id: product.id,
            title: product.title,
            value: c.after,
          })),
        ),
      },
    });

    if (anySucceeded) {
      await spendCredit(shop, "automation_execution");
      await db.automation.update({
        where: { id: automation.id },
        data: { runCount: { increment: 1 }, lastRunAt: new Date() },
      });
    }
  }
}
