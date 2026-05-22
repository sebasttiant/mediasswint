-- Add patient sex to choose the measurement body guide silhouette.
CREATE TYPE "PatientSex" AS ENUM ('FEMALE', 'MALE');

ALTER TABLE "Patient" ADD COLUMN "sex" "PatientSex";
