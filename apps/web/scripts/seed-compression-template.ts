import "dotenv/config";

import { syncCompressionTemplate } from "@/lib/measurement-templates";

async function main() {
  const result = await syncCompressionTemplate();
  console.log(
    `[templates:seed] synced template ${result.templateId} (${result.sectionsCount} sections, ${result.fieldsCount} fields)`,
  );
}

main().catch((error) => {
  console.error("[templates:seed] failed", error);
  process.exitCode = 1;
});
