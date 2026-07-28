import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  MP_BERMUDA_TEMPLATE_CODE,
  buildMpBermudaTemplate,
} from "../lib/mp-bermuda-template";
import {
  syncMpBermudaTemplate,
  type MeasurementTemplatesRepository,
} from "../lib/measurement-templates";

function fieldsOfTemplate() {
  return buildMpBermudaTemplate().sections.flatMap((section) => section.fields);
}

function fieldByKey(key: string) {
  const field = fieldsOfTemplate().find((candidate) => candidate.key === key);
  assert.ok(field, `expected ${key} in the MP/Bermuda catalog`);
  return field;
}

describe("buildMpBermudaTemplate", () => {
  it("defines the exact required 5 shared, 26 bilateral circumference, and 24 bilateral distance fields", () => {
    const template = buildMpBermudaTemplate();
    const fields = fieldsOfTemplate();
    const sharedFields = fields.filter((field) => field.metadata.side === "shared");
    const circumferenceFields = fields.filter((field) => field.metadata.kind === "circumference");
    const distanceFields = fields.filter((field) => field.metadata.kind === "distance");

    assert.equal(template.code, MP_BERMUDA_TEMPLATE_CODE);
    assert.equal(fields.length, 55);
    assert.equal(new Set(fields.map((field) => field.key)).size, 55);
    assert.equal(sharedFields.length, 5);
    assert.equal(circumferenceFields.length, 26);
    assert.equal(distanceFields.length, 24);
    assert.ok(fields.every((field) => field.isRequired));
    assert.deepEqual(
      sharedFields.map((field) => field.key),
      [
        "mpHeight",
        "mpWeight",
        "mpShoeSize",
        "mpWaistToGlutealFoldLength",
        "mpGlutealFoldToFloorLength",
      ],
    );
    assert.deepEqual(
      sharedFields.map((field) => [field.label, field.unit]),
      [
        ["Estatura", "cm"],
        ["Peso", "kg"],
        ["Talla calzado", "size"],
        ["Largo de la cintura al pliegue de la nalga", "cm"],
        ["Largo del pliegue de la nalga al piso", "cm"],
      ],
    );
    assert.deepEqual(
      sharedFields.map((field) => [field.minValue, field.maxValue]),
      [
        [50, 250],
        [1, 500],
        [1, 60],
        [0.1, 300],
        [0.1, 300],
      ],
    );
    assert.deepEqual(fieldByKey("mpWaistToGlutealFoldLength").metadata, {
      layout: "mp-bermuda",
      kind: "length",
      side: "shared",
      markerId: "shared-mpWaistToGlutealFoldLength",
      anatomyZone: "mp-bermuda.shared.mpWaistToGlutealFoldLength",
      fromStationId: "waist",
      toStationId: "glutealFold",
    });
    assert.equal(fieldByKey("mpGlutealFoldToFloorLength").metadata.fromStationId, "glutealFold");
    assert.equal(fieldByKey("mpGlutealFoldToFloorLength").metadata.toStationId, "floor");
  });

  it("keeps every station and adjacent interval independent by side with explicit endpoint metadata", () => {
    const stations = [
      "waist",
      "hip",
      "groin",
      "belowGroin10",
      "midThigh",
      "knee",
      "belowKnee",
      "calfMax",
      "calfStart",
      "aboveAnkle",
      "heelAnkle",
      "toeRoot",
      "footDorsum",
    ];

    for (const [side, sideName] of [["right", "Right"], ["left", "Left"]] as const) {
      for (const station of stations) {
        const field = fieldByKey(`mp${sideName}${station[0].toUpperCase()}${station.slice(1)}Circumference`);
        assert.equal(field.metadata.side, side);
        assert.equal(field.metadata.stationId, station);
        assert.equal(field.metadata.kind, "circumference");
        assert.equal(field.unit, "cm");
        assert.equal(field.minValue, 0.1);
        assert.equal(field.maxValue, 300);
      }

      for (const [fromStationId, toStationId] of stations.slice(0, -1).map((station, index) => [station, stations[index + 1]] as const)) {
        const field = fieldByKey(
          `mp${sideName}${fromStationId[0].toUpperCase()}${fromStationId.slice(1)}To${toStationId[0].toUpperCase()}${toStationId.slice(1)}Distance`,
        );
        assert.equal(field.metadata.side, side);
        assert.equal(field.metadata.kind, "distance");
        assert.equal(field.metadata.fromStationId, fromStationId);
        assert.equal(field.metadata.toStationId, toStationId);
      }
    }

    assert.ok(fieldsOfTemplate().every((field) => field.metadata.layout === "mp-bermuda"));
    assert.ok(fieldsOfTemplate().every((field) => field.metadata.markerId.length > 0));
    assert.ok(!JSON.stringify(buildMpBermudaTemplate()).includes("3.8"));
  });
});

describe("syncMpBermudaTemplate", () => {
  it("registers the additive mp-bermuda-v1 catalog through the existing synchronization seam", async () => {
    const syncedFields: string[] = [];
    const repository: MeasurementTemplatesRepository = {
      async upsertTemplate() {
        return { id: "mp-template" };
      },
      async upsertSection(input) {
        return { id: `section-${input.sortOrder}` };
      },
      async upsertField(input) {
        syncedFields.push(input.key);
        return { id: input.key };
      },
      async deactivateFieldsNotIn() {
        return { deactivated: 0 };
      },
      async deactivateSectionsNotIn() {
        return { deactivated: 0 };
      },
    };

    const result = await syncMpBermudaTemplate(repository);

    assert.equal(result.templateId, "mp-template");
    assert.equal(result.fieldsCount, 55);
    assert.equal(new Set(syncedFields).size, 55);
    assert.ok(syncedFields.includes("mpRightWaistCircumference"));
    assert.ok(syncedFields.includes("mpLeftWaistToHipDistance"));
  });
});
