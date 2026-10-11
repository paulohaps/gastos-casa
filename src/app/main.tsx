import { startApplication } from "./App";
import {
  mountAssistant,
  mountWallets,
  mountOverview,
  mountSettings,
} from "./legacy-bridge";
import { FeatureBoundary } from "../shared/ui/FeatureBoundary";
import { Assistant } from "../features/assistant/Assistant";
import "../../css/chat.css";
import { createWalletController } from "../features/wallets/controller";
import { Wallets } from "../features/wallets/Wallets";
import { createOverviewController } from "../features/overview/controller";
import { Overview } from "../features/overview/Overview";
import { Settings } from "../features/settings/Settings";

startApplication();

mountAssistant((ports) => (
  <FeatureBoundary>
    <Assistant ports={ports} />
  </FeatureBoundary>
));
mountWallets(createWalletController(), (controller) => (
  <FeatureBoundary>
    <Wallets controller={controller} />
  </FeatureBoundary>
));

mountOverview(createOverviewController(), (controller) => (
  <FeatureBoundary>
    <Overview controller={controller} />
  </FeatureBoundary>
));

mountSettings((ports) => (
  <FeatureBoundary>
    <Settings ports={ports} />
  </FeatureBoundary>
));
