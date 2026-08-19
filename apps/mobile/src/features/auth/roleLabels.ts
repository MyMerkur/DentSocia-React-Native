import { CANDIDATE_ROLES, EMPLOYER_ROLES, type CandidateRole, type EmployerRole } from "@dentsocia/shared-constants";

export type UserRole = CandidateRole | EmployerRole;

export const ROLE_LABELS: Record<UserRole, string> = {
  hekim: "Diş Hekimi",
  asistan: "Asistan",
  teknisyen: "Diş Teknisyeni",
  klinik: "Klinik",
  firma: "Firma",
  dernek: "Dernek",
};

export const CANDIDATE_ROLE_LIST = CANDIDATE_ROLES as readonly UserRole[];
export const EMPLOYER_ROLE_LIST = EMPLOYER_ROLES as readonly UserRole[];
