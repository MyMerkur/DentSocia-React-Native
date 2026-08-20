// PRD v3 §8.1/§8.2 — ilan formu alan seçenekleri, PRD metniyle birebir.

export const JOB_POSITIONS = [
  "Diş hekimi",
  "Uzman diş hekimi",
  "Diş teknisyeni",
  "Klinik asistanı",
  "Hasta danışmanı",
  "Diğer",
] as const;
export type JobPosition = (typeof JOB_POSITIONS)[number];

export const JOB_BRANCHES = [
  "Ortodonti",
  "Endodonti",
  "Periodontoloji",
  "Ağız-Çene Cerrahisi",
  "Pedodonti",
  "Protez",
  "Restoratif",
  "Radyoloji",
  "Fark etmez",
] as const;
export type JobBranch = (typeof JOB_BRANCHES)[number];

export const JOB_WORK_TYPES = ["Tam zamanlı", "Yarı zamanlı", "Misafir hekim", "Geçici (gün bazlı)"] as const;
export type JobWorkType = (typeof JOB_WORK_TYPES)[number];

export const JOB_WEEKDAYS = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"] as const;
export type JobWeekday = (typeof JOB_WEEKDAYS)[number];

export const JOB_PAYMENT_MODELS = ["Sabit maaş", "Ciro primi", "Sabit + prim", "Hak ediş"] as const;
export type JobPaymentModel = (typeof JOB_PAYMENT_MODELS)[number];

export const JOB_EXPERIENCE_LEVELS = ["Yeni mezun olabilir", "1-3 yıl", "3-5 yıl", "5+ yıl"] as const;
export type JobExperienceLevel = (typeof JOB_EXPERIENCE_LEVELS)[number];

export const JOB_SALARY_TYPES = ["net", "brüt"] as const;
export type JobSalaryType = (typeof JOB_SALARY_TYPES)[number];

export const JOB_CLINIC_AMENITIES = [
  "Asistan desteği",
  "Dijital ölçü",
  "Tomografi",
  "Mikroskop",
  "Laboratuvar anlaşması",
] as const;
export type JobClinicAmenity = (typeof JOB_CLINIC_AMENITIES)[number];
