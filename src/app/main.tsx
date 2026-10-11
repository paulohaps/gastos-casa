import { mountAssistant } from "./legacy-bridge";
import { FeatureBoundary } from "../shared/ui/FeatureBoundary";
import { Assistant } from "../features/assistant/Assistant";
import "../../css/chat.css";
import { mountWallets } from "./legacy-bridge";
import { createWalletController } from "../features/wallets/controller";
import { Wallets } from "../features/wallets/Wallets";
import { mountOverview } from "./legacy-bridge";
import { createOverviewController } from "../features/overview/controller";
import { Overview } from "../features/overview/Overview";
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
