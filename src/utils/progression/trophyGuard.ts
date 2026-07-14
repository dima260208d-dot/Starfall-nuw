import { useI18n } from "../../i18n/I18nProvider";
import {
  getFeatureTrophyRequirement,
  isFeatureUnlocked,
  type TrophyFeatureId,
} from "./trophyUnlocks";
import { showTrophyLockToast } from "./trophyLockToast";

export function guardTrophyFeature(
  featureId: TrophyFeatureId,
  action: () => void,
  t: (id: string, params?: Record<string, string | number>) => string,
): void {
  if (isFeatureUnlocked(featureId)) {
    action();
    return;
  }
  showTrophyLockToast(t("unlock.needTrophies", { count: getFeatureTrophyRequirement(featureId) }));
}

export function guardTrophyThreshold(
  required: number,
  trophies: number,
  action: () => void,
  t: (id: string, params?: Record<string, string | number>) => string,
): void {
  if (required <= 0 || trophies >= required) {
    action();
    return;
  }
  showTrophyLockToast(t("unlock.needTrophies", { count: required }));
}

export function useTrophyGuard() {
  const { t } = useI18n();
  return {
    tryFeature(featureId: TrophyFeatureId, action: () => void) {
      guardTrophyFeature(featureId, action, t);
    },
    tryThreshold(required: number, trophies: number, action: () => void) {
      guardTrophyThreshold(required, trophies, action, t);
    },
  };
}
