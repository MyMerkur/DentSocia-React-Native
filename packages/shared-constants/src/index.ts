export * from "./featureFlags";

export const MICRO_COMPETENCY_TAGS = [
  "Endodonti",
  "Ortodonti",
  "Periodontoloji",
  "Protetik Diş Tedavisi",
  "Ağız Diş ve Çene Cerrahisi",
  "Pedodonti",
  "Restoratif Diş Tedavisi",
  "İmplantoloji",
  "Estetik Diş Hekimliği",
  "Oral Diagnoz ve Radyoloji",
  "Diş Hekimliğinde Anestezi",
  "Halk Ağız Diş Sağlığı",
  "Klinik Asistanlığı",
  "Diş Teknisyenliği",
  "Steril Hizmetler",
  "Klinik Yönetimi",
  "Hasta İlişkileri",
  "Satış ve Pazarlama",
  "Ürün Danışmanlığı",
  "Eğitim ve Akademik Çalışma",
] as const;

export type MicroCompetencyTag = (typeof MICRO_COMPETENCY_TAGS)[number];

export const EMPLOYER_ROLES = ["klinik", "firma", "dernek"] as const;
export type EmployerRole = (typeof EMPLOYER_ROLES)[number];

export const CANDIDATE_ROLES = ["hekim", "asistan", "teknisyen"] as const;
export type CandidateRole = (typeof CANDIDATE_ROLES)[number];
