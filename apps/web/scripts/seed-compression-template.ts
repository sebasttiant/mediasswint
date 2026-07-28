import {
  syncCompressionTemplate,
  syncMascaraTemplate,
  syncMentoneraTemplate,
  syncMpBermudaTemplate,
} from "@/lib/measurement-templates";

async function main() {
  const result = await syncCompressionTemplate();
  console.log(
    `[templates:seed] synced template ${result.templateId} (${result.sectionsCount} sections, ${result.fieldsCount} fields)`,
  );

  const mentoneraResult = await syncMentoneraTemplate();
  console.log(
    `[templates:seed] synced template ${mentoneraResult.templateId} (${mentoneraResult.sectionsCount} sections, ${mentoneraResult.fieldsCount} fields)`,
  );

  const mascaraResult = await syncMascaraTemplate();
  console.log(
    `[templates:seed] synced template ${mascaraResult.templateId} (${mascaraResult.sectionsCount} sections, ${mascaraResult.fieldsCount} fields)`,
  );

  const mpBermudaResult = await syncMpBermudaTemplate();
  console.log(
    `[templates:seed] synced template ${mpBermudaResult.templateId} (${mpBermudaResult.sectionsCount} sections, ${mpBermudaResult.fieldsCount} fields)`,
  );
}

main().catch((error) => {
  console.error("[templates:seed] failed", error);
  process.exitCode = 1;
});
