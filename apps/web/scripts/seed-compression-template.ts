import { syncCompressionTemplate, syncMentoneraTemplate } from "@/lib/measurement-templates";

async function main() {
  const result = await syncCompressionTemplate();
  console.log(
    `[templates:seed] synced template ${result.templateId} (${result.sectionsCount} sections, ${result.fieldsCount} fields)`,
  );

  const mentoneraResult = await syncMentoneraTemplate();
  console.log(
    `[templates:seed] synced template ${mentoneraResult.templateId} (${mentoneraResult.sectionsCount} sections, ${mentoneraResult.fieldsCount} fields)`,
  );
}

main().catch((error) => {
  console.error("[templates:seed] failed", error);
  process.exitCode = 1;
});
