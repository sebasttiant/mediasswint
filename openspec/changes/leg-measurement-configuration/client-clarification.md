# Client Clarification — MR leg measurement count

**This blocks Stage 2 of `leg-measurement-configuration`. Do not implement the
leg catalog, validation, SVG re-tracing, or template migration until answered.**

## What we need decided

The MR form defines **13** values per leg. The client annotation says **15**.
We need the client to either confirm 13, or name the 2 additional values.

Attach the numbered diagram when asking — it numbers every position on the
client's own form, so the answer can be given by referring to the labels.

Diagram (**outside this repository**, private client material — do not commit):

    MEDIASSWINTERNO/MEJORAS/mr-leg-numbered.png

## Confirmed positions (13, in order)

Circumferences (7): `C1` Debajo de la rodilla · `C2` Parte más gruesa de la
pantorrilla · `C3` Inicio de pantorrilla · `C4` Parte más delgada encima del
tobillo · `C5` Talón y tobillos · `C6` Empeine · `C7` Nacimiento de los dedos.

Intermediate distances (6): `D1`..`D6`, one between each adjacent pair of
circumferences.

## Ready-to-send question (Spanish)

> Necesitamos confirmar un dato antes de programar la toma de medidas de pierna,
> porque afecta la base de datos y las mediciones ya registradas.
>
> En el formato **"Media a la rodilla" (MR)** contamos, por cada pierna:
>
> - **7 circunferencias**: debajo de la rodilla, parte más gruesa de la
>   pantorrilla, inicio de pantorrilla, parte más delgada encima del tobillo,
>   talón y tobillos, empeine, y nacimiento de los dedos.
> - **6 distancias intermedias**: una entre cada par de circunferencias
>   consecutivas.
>
> Eso da **13 medidas por pierna**, pero en la captura que nos enviaron está
> anotado **"solo 15 medidas"**.
>
> En la imagen adjunta numeramos cada casilla del formato (C1–C7 en rojo para
> las circunferencias, D1–D6 en azul para las distancias).
>
> **Pregunta: ¿cuáles son las 2 medidas que faltan para llegar a 15?**
>
> Por ejemplo:
> 1. ¿Son dos **largos** de la pierna (por ejemplo, largo total de la pierna o
>    largo del pie), parecidos a los campos "Largo…" que aparecen en el formato
>    de media pantalón?
> 2. ¿Son dos **circunferencias** adicionales? Si es así, ¿en qué parte de la
>    pierna van, y llevan también su distancia intermedia?
> 3. ¿O el número correcto es **13** y el "15" fue un conteo aproximado?
>
> Cualquiera de las tres opciones nos sirve; solo necesitamos que nos confirmen
> cuál es, para no registrar medidas que después haya que corregir.

## Second question (separate, lower priority)

> En la otra imagen aparece la nota **"entre espacio y espacio hay 3.8 cm"**.
> Esa nota está sobre el formato de **media pantalón / muñón**, no sobre el de
> media a la rodilla. ¿Es correcto que los 3.8 cm aplican **solo** a las bandas
> del muñón, y que en la media a la rodilla las distancias intermedias se siguen
> midiendo paciente por paciente?

## Why we are not guessing

Picking 13 or 15 arbitrarily would determine:

- the seeded `MeasurementTemplate` and every future clinical record;
- the hand-traced SVG zone paths for both body figures;
- how the ~28-ordinal historical sessions are reinterpreted.

An ambiguous business rule that affects historical clinical data and a database
migration is not resolved by choosing the more likely number.
