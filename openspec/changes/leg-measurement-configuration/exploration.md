# Exploration: Leg Measurement Configuration

## Client material — referenced, never committed

The client's capture forms and annotated screenshots are private business
material. They live **outside this repository** and must stay there. This
document references them by filename only; no client-source image, scan, or
form is embedded in or committed to the repo.

External directory (not version-controlled): `MEDIASSWINTERNO/MEJORAS/`

## Evidence sources

All in the external directory above:

| Source | Role |
| --- | --- |
| `Formato Toma de mdidas MR 2024 18oct.pdf` | **Authoritative** MR (knee-high) capture form |
| `MEDIDAS 15 .png` | Screenshot of the MR form + client annotation "SOLO 15 MEDIDAS" |
| `ESPACIO ENTRE MEDIDA .png` | Screenshot of the **MP / amputee-stump** form + client annotation "3.8 CM" |
| `Formato Toma de medidas Bermuda y MP 2024 18oct.pdf` | The MP/Bermuda form the 3.8 cm note belongs to |
| `mr-leg-numbered.png` | **Derived:** the MR leg with every position numbered (C1–C7 circumferences, D1–D6 distances), for the client clarification |

Counts below were obtained by scanning the rendered pixels of the form (red
band detection) and confirmed visually against a 200 DPI render of the PDF.
They are not eyeballed.

## Finding 1 — the MR leg has 13 values, not 15

Per leg, in anatomical order from knee to toes:

| # | Position | Kind |
| --- | --- | --- |
| C1 | Debajo de la rodilla | circumference |
| D1 | distancia C1 → C2 | distance |
| C2 | Parte más gruesa de la pantorrilla | circumference |
| D2 | distancia C2 → C3 | distance |
| C3 | Inicio de pantorrilla | circumference |
| D3 | distancia C3 → C4 | distance |
| C4 | Parte más delgada encima del tobillo | circumference |
| D4 | distancia C4 → C5 | distance |
| C5 | Talón y tobillos | circumference |
| D5 | distancia C5 → C6 | distance |
| C6 | Empeine | circumference |
| D6 | distancia C6 → C7 | distance |
| C7 | Nacimiento de los dedos | circumference |

**7 circumferences + 6 intermediate distances = 13 values per leg.**

The order is deterministic and strictly alternating: a distance exists for
every adjacent pair of circumferences, so `distances = circumferences - 1`.
Both legs (derecha / izquierda) carry the identical configuration.

Annotated diagram: `mr-leg-numbered.png`, stored **outside this repository** in the
business-material directory (see "Client material" below).

## Finding 2 — the two missing values are undefined

To reach the client's 15, two further values are required. The form defines
neither their anatomy nor their kind. Under the alternating structure above,
7 circumferences can only ever produce 6 intermediate distances, so the two
extra values cannot be additional intermediates between the existing
landmarks. They must be something else — and nothing in the evidence says what.

Plausible candidates, none confirmed, none to be assumed:

1. Two extra **circumferences** (would make 9 circ + 8 dist = 17, not 15 — so
   this is internally inconsistent and probably wrong).
2. Two **lengths** of the whole limb, analogous to the `Largo…` fields present
   on the MP form (e.g. total leg length, foot length).
3. Two fields from a **different garment format** that the client mentally
   merged into this one.
4. A simple **miscount** by the client, and the real answer is 13.

This is the blocking question. See `client-clarification.md`.

## Finding 3 — 3.8 cm belongs to a different garment

The "ENTRE ESPACIO Y ESPACIO HAY 3.8CM" annotation is on
`ESPACIO ENTRE MEDIDA .png`, which is **not** the MR form. That sheet shows
`Cintura`, `Cadera`, `Ingle` and `Largo desde la ingle hasta donde termina el
muñón` — it is the **MP / amputee-stump** format. The 3.8 cm arrow points at the
bands **on the stump**, where bands are placed at fixed regular intervals
because there are no anatomical landmarks left to reference.

On the MR form the intermediate distances are explicitly **measured per
patient** — the form instructs: *"mida las distancias entre cada uno de los
puntos y anótelas en los intermedios de las medidas."* They vary by leg, which
is precisely why the clinician records them.

**Conclusion:** 3.8 cm is a fixed band pitch for stump measurement, not a
spacing rule for MR legs. Modelling it as a leg-configuration constant would
encode a business rule the client never stated. Treat it as a separate change
scoped to the MP/stump format.

## Finding 4 — current model and blast radius

Canonical config: `apps/web/lib/compression-measurements.ts`

```ts
const LEG_POINTS = [1, 2, ... 28] as const;   // opaque ordinals
const ARM_POINTS = [1, 2, ... 19] as const;
label: `Pierna ${sideLabel} punto ${point}`   // no anatomy
unit: "cm"                                    // no kind discriminator
```

`COMPRESSION_MEASUREMENTS` = 28×2 legs + 19×2 arms = **94 definitions**.

Everything derives from it at runtime, but the count is *baked* in places that
will not follow a change automatically:

| Location | Assumption | Follows a count change? |
| --- | --- | --- |
| `lib/compression-measurements.ts` | `LEG_POINTS` = 28 | **the declaration** |
| `app/_components/body-highlight/zones-male.ts` | 94 hand-traced SVG paths keyed `legs.right.1..28` | **No — silent fallback** |
| `app/_components/body-highlight/zones-female.ts` | same 94 | **No — silent fallback** |
| `body-highlight-calibration.ts` | coords tuned for "leg 28, arm 19" | No (visual drift) |
| `lib/body-anatomy.ts` | prose `"28 puntos por lado"` | No (was hardcoded — **fixed in this change**) |
| `body-highlight-zones.ts` | `MAX_POINT_BY_GROUP` via reduce | Yes |
| UI (`zone-strip`, `measurement-shell`, detail) | iterates `templateSnapshot` | Yes |

The silent fallback is the dangerous one: `getFullZonePathForSex` does
`tracedPath ?? getFullMarkerForSex(...)`, so a leg zone with no traced path
renders a generated rectangle instead of anatomy — with no error. Guarded in
this change (see `tasks.md`).

## Finding 5 — historical-record compatibility

`MeasurementSession.templateSnapshot` (Json) freezes the template at session
creation, and `MeasurementValue` rows are relational per `TemplateField`. So:

- Old sessions **still render**, because they read their own frozen snapshot.
- `syncCompressionTemplate` **upserts and never deletes** stale `TemplateField`
  rows, so old values keep resolving.

But the key `legRight7` would silently change meaning from *"ordinal 7 of 28"*
to a **named anatomical landmark**. Same key, different semantics. Any Stage 2
implementation must decide explicitly between:

- **versioning** the template (`compression-v2`) and leaving `v1` sessions on
  the old catalog — preserves history, recommended; or
- reinterpreting in place — silently changes the meaning of historical clinical
  records and is **not acceptable** without client sign-off.

No migration is performed in this change because no schema or catalog shape
changed.
