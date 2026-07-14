import { useMemo } from "react";
import { getProfileByPlayerId } from "../utils/playerGiftSend";
import ProfileScreen from "../components/ProfileScreen";
import { PageBg, PageBody, PageHeader } from "../components/PageChrome";
import { useI18n } from "../i18n";
import { Tr } from "../i18n/Tr";

interface Props {
  playerId: string;
  onBack: () => void;
  onViewClub: (clubId: string) => void;
}

export default function PlayerProfilePage({ playerId, onBack, onViewClub }: Props) {
  const { t } = useI18n();
  const profile = useMemo(() => getProfileByPlayerId(playerId), [playerId]);

  if (!profile) {
    return (
      <PageBg variant="profile">
        <PageHeader onBack={onBack} title={t("profile.title")} />
        <PageBody>
          <div style={{ textAlign: "center", padding: 40, color: "rgba(255,255,255,0.6)" }}>
            <Tr id="profile.notFound" />
          </div>
        </PageBody>
      </PageBg>
    );
  }

  return (
    <ProfileScreen
      profile={profile}
      readOnly
      headerTitle={t("profile.playerTitle")}
      onBack={onBack}
      onViewClub={onViewClub}
    />
  );
}
