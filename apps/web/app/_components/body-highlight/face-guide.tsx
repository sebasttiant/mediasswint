import { BODY_FIGURE_SEX, type BodyFigureSex } from "./body-highlight";
import styles from "./body-highlight.module.css";

export type FaceGuideProps = {
  sex?: BodyFigureSex;
  className?: string;
  ariaLabel?: string;
};

const FACE_GUIDE_VIEWBOX = {
  width: 160,
  height: 180,
} as const;

const FACE_GUIDE_PATHS: Record<BodyFigureSex, { face: string; jaw: string; hair: string; brow: string }> = {
  female: {
    face: "M 80 24 C 48 24, 32 52, 34 88 C 36 129, 55 156, 80 156 C 105 156, 124 129, 126 88 C 128 52, 112 24, 80 24 Z",
    jaw: "M 50 100 C 58 136, 68 150, 80 150 C 92 150, 102 136, 110 100",
    hair: "M 35 82 C 32 48, 50 18, 80 18 C 110 18, 128 48, 125 82 C 116 52, 101 38, 80 38 C 59 38, 44 52, 35 82 Z",
    brow: "M 53 78 C 62 74, 69 74, 75 78 M 85 78 C 91 74, 98 74, 107 78",
  },
  male: {
    face: "M 80 22 C 51 22, 34 48, 36 86 C 39 128, 55 158, 80 158 C 105 158, 121 128, 124 86 C 126 48, 109 22, 80 22 Z",
    jaw: "M 48 102 C 55 140, 67 158, 80 158 C 93 158, 105 140, 112 102",
    hair: "M 36 72 C 36 42, 54 18, 80 18 C 106 18, 124 42, 124 72 C 112 47, 98 37, 80 37 C 62 37, 48 47, 36 72 Z",
    brow: "M 51 76 C 61 71, 70 71, 76 76 M 84 76 C 90 71, 99 71, 109 76",
  },
};

export function FaceGuide({
  sex = BODY_FIGURE_SEX.FEMALE,
  className,
  ariaLabel,
}: FaceGuideProps) {
  const paths = FACE_GUIDE_PATHS[sex];
  const label = ariaLabel ?? `Guía de rostro ${sex === BODY_FIGURE_SEX.MALE ? "masculino" : "femenino"}`;
  const svgClassName = [styles.faceGuideSvg, className].filter(Boolean).join(" ");

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${FACE_GUIDE_VIEWBOX.width} ${FACE_GUIDE_VIEWBOX.height}`}
      className={svgClassName}
      data-sex={sex}
    >
      <title>{label}</title>
      <desc>Referencia visual de cabeza y rostro para medidas faciales.</desc>
      <path className={styles.faceHair} d={paths.hair} />
      <path className={styles.faceShape} d={paths.face} />
      <path className={styles.faceJaw} d={paths.jaw} />
      <path className={styles.faceFeature} d={paths.brow} />
      <circle className={styles.faceFeature} cx="62" cy="89" r="3" />
      <circle className={styles.faceFeature} cx="98" cy="89" r="3" />
      <path className={styles.faceFeature} d="M 80 92 C 76 104, 77 112, 83 115" />
      <path className={styles.faceFeature} d="M 62 130 C 72 137, 88 137, 98 130" />
      <g className={styles.faceGuideLines} aria-hidden="true">
        <path d="M 39 88 L 121 88" />
        <path d="M 50 116 L 110 116" />
        <path d="M 80 38 L 80 153" />
      </g>
    </svg>
  );
}
