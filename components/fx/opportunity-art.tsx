import { StripArt, TallyMark } from "./tally";

export type FxArtKind = "orbit" | "survey" | "garden" | "task" | "offer" | "puzzle";
export type FxArtAccent = "peach" | "lavender" | "green" | "blue" | "yellow";

export interface FxArt {
  art: FxArtKind;
  accent: FxArtAccent;
  category: string;
  title: string;
  /** Optional neutral wordmark lines (defaults preserve the artwork's own motif). */
  wordmark?: [string, string];
}

const ART_LABEL: Record<FxArtKind, string> = {
  orbit: "ORBIT",
  survey: "SURVEY",
  garden: "GARDEN",
  task: "TASK",
  offer: "OFFER",
  puzzle: "PUZZLE",
};

/**
 * Tally artwork: category-driven strip arrangement with collector edition
 * label. Props stay compatible with existing call sites; `accent` is
 * accepted but the palette now follows `category` via CSS.
 */
export function OpportunityArt({
  opportunity,
  large = false,
}: {
  opportunity: FxArt;
  large?: boolean;
}) {
  const { art, category } = opportunity;
  return (
    <div
      className={`opportunity-art tally-opportunity-art category-${category} ${large ? "art-large" : ""}`}
      aria-hidden="true"
    >
      <span className="art-category">{category}</span>
      <StripArt category={category} />
      <span className="art-edition">FREEARN / {ART_LABEL[art]}</span>
      <TallyMark size={23} className="art-brand" />
    </div>
  );
}
