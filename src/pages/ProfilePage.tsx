import { useState } from "react";
import { getCurrentProfile } from "../utils/localStorageAPI";
import ProfileScreen from "../components/ProfileScreen";
import { useI18n } from "../i18n";

interface Props {
  onBack: () => void;
  onViewClub?: (clubId: string) => void;
}

export default function ProfilePage({ onBack, onViewClub }: Props) {
  const { t } = useI18n();
  const [, setTick] = useState(0);
  const profile = getCurrentProfile();
  if (!profile) return null;

  return (
    <ProfileScreen
      profile={profile}
      readOnly={false}
      headerTitle={t("profile.title")}
      onBack={onBack}
      onViewClub={onViewClub}
      onProfileChange={() => setTick(t => t + 1)}
    />
  );
}
