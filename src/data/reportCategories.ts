/** Жалобы на игроков — категории с описанием и CDN/локальные иконки. */
import { resolveHeavyAssetUrl } from "../lib/assetBase";

export type ReportCategoryId =
  | "cheating"
  | "fraud"
  | "bad_name"
  | "harassment"
  | "sabotage"
  | "gameplay";

export interface ReportCategoryDef {
  id: ReportCategoryId;
  titleKey: string;
  descKey: string;
  imageUrl: string;
}

export const REPORT_CATEGORIES: ReportCategoryDef[] = [
  {
    id: "cheating",
    titleKey: "report.cat.cheating.title",
    descKey: "report.cat.cheating.desc",
    imageUrl: resolveHeavyAssetUrl("ui/report-cheating.png"),
  },
  {
    id: "fraud",
    titleKey: "report.cat.fraud.title",
    descKey: "report.cat.fraud.desc",
    imageUrl: resolveHeavyAssetUrl("ui/report-fraud.png"),
  },
  {
    id: "bad_name",
    titleKey: "report.cat.badName.title",
    descKey: "report.cat.badName.desc",
    imageUrl: resolveHeavyAssetUrl("ui/report-bad-name.png"),
  },
  {
    id: "harassment",
    titleKey: "report.cat.harassment.title",
    descKey: "report.cat.harassment.desc",
    imageUrl: resolveHeavyAssetUrl("ui/report-harassment.png"),
  },
  {
    id: "sabotage",
    titleKey: "report.cat.sabotage.title",
    descKey: "report.cat.sabotage.desc",
    imageUrl: resolveHeavyAssetUrl("ui/report-sabotage.png"),
  },
  {
    id: "gameplay",
    titleKey: "report.cat.gameplay.title",
    descKey: "report.cat.gameplay.desc",
    imageUrl: resolveHeavyAssetUrl("ui/report-gameplay.png"),
  },
];

export function getReportCategory(id: ReportCategoryId): ReportCategoryDef | undefined {
  return REPORT_CATEGORIES.find((c) => c.id === id);
}
