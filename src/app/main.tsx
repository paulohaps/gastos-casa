import { mountAssistant } from "./legacy-bridge";
import { FeatureBoundary } from "../shared/ui/FeatureBoundary";
import { Assistant } from "../features/assistant/Assistant";
import "../../css/chat.css";
mountAssistant((ports) => (
  <FeatureBoundary>
    <Assistant ports={ports} />
  </FeatureBoundary>
));
