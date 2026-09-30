import { Spark } from "./icon";

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

export function OpportunityArt({
  opportunity,
  large = false,
}: {
  opportunity: FxArt;
  large?: boolean;
}) {
  const { art, accent, category, title } = opportunity;
  return (
    <div
      className={`opportunity-art tone-${accent} art-${art} ${large ? 'art-large' : ''}`}
      aria-hidden="true"
    >
      <div className="art-noise" />
      <span className="art-wordmark">
        {opportunity.wordmark ? (
          <>
            <span>{opportunity.wordmark[0]}</span>
            <span>{opportunity.wordmark[1]}</span>
          </>
        ) : art === 'orbit' ? (
          <>
            <span>ORBIT</span>
            <span>RACERS</span>
          </>
        ) : art === 'garden' ? (
          <>
            <span>POCKET</span>
            <span>GARDEN</span>
          </>
        ) : art === 'puzzle' ? (
          <>
            <span>PIXEL</span>
            <span>PATH</span>
          </>
        ) : art === 'survey' ? (
          <span className="survey-quote">“</span>
        ) : art === 'task' ? (
          <span className="task-glyph">✓</span>
        ) : (
          <span className="offer-glyph">
            Aa
            <span>
              fresh
              <br />
              pages.
            </span>
          </span>
        )}
      </span>
      <div className="art-geometry">
        <svg viewBox="0 0 200 160" fill="none">
          {art === 'orbit' ? (
            <>
              <ellipse
                cx="120"
                cy="90"
                rx="65"
                ry="23"
                transform="rotate(-40 120 90)"
                stroke="currentColor"
                strokeWidth="22"
              />
              <ellipse
                cx="120"
                cy="90"
                rx="65"
                ry="23"
                transform="rotate(40 120 90)"
                stroke="currentColor"
                strokeWidth="2"
              />
              <circle cx="148" cy="44" r="10" fill="currentColor" />
            </>
          ) : art === 'garden' ? (
            <>
              <path
                d="M100 5v150M25 80h150M47 27l106 106M47 133 153 27"
                stroke="currentColor"
                strokeWidth="30"
              />
              <circle cx="100" cy="80" r="28" fill="var(--art-bg)" />
              <circle cx="100" cy="80" r="9" fill="currentColor" />
            </>
          ) : art === 'task' ? (
            <>
              <rect
                x="55"
                y="15"
                width="95"
                height="110"
                rx="5"
                transform="rotate(12 55 15)"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path d="m78 51 14 14 27-30M78 92h40" stroke="currentColor" strokeWidth="7" />
            </>
          ) : art === 'puzzle' ? (
            <>
              <path
                d="M50 15h40v40H50ZM95 60h40v40H95ZM50 105h40v40H50ZM140 105h40v40h-40Z"
                fill="currentColor"
              />
              <path d="M140 15h40v40h-40Z" stroke="currentColor" strokeWidth="2" />
            </>
          ) : (
            <>
              {[0, 1, 2, 3].map((x) =>
                [0, 1, 2].map((y) => (
                  <rect
                    key={`${x}-${y}`}
                    x={30 + x * 37}
                    y={18 + y * 37}
                    width="23"
                    height="23"
                    rx={art === 'survey' ? 12 : 0}
                    stroke="currentColor"
                    strokeWidth="2"
                    fill={(x + y) % 3 === 0 ? 'currentColor' : 'none'}
                  />
                )),
              )}
            </>
          )}
        </svg>
      </div>
      <span className="art-category">{category.slice(0, -1)}</span>
      {art === 'survey' && (
        <span className="art-caption">
          A fresh perspective.
          <br />
          {title.includes('daily') ? 'Your everyday.' : 'Yours.'}
        </span>
      )}
      <Spark size={17} className="art-brand" />
    </div>
  );
}
