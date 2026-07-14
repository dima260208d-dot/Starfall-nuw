import App from "./App";
import { UiStage } from "./platform";

/** Game always available; headless training is controlled from the admin panel. */
export default function AppShell() {
  return (
    <UiStage>
      <App />
    </UiStage>
  );
}
