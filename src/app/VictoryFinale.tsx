import { useEffect, type CSSProperties } from "react";

const FINALE_DURATION_MS = 1_420;

const SPARK_VECTORS = [
  [-28, 0],
  [-20, -20],
  [0, -30],
  [21, -21],
  [30, 0],
  [21, 21],
  [0, 30],
  [-21, 21],
] as const;

const FIREWORKS = [
  { left: 20, top: 25, delay: 560, colors: ["#7ee9f2", "#f4f7ff"] },
  { left: 76, top: 20, delay: 700, colors: ["#ffc65c", "#fff0a8"] },
  { left: 52, top: 43, delay: 840, colors: ["#ff7869", "#8dd8ff"] },
] as const;

interface VictoryFinaleProps {
  readonly onFinished: () => void;
}

export function VictoryFinale({ onFinished }: VictoryFinaleProps) {
  useEffect(() => {
    const timer = window.setTimeout(onFinished, FINALE_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [onFinished]);

  return (
    <div className="victory-finale" data-testid="victory-finale" aria-hidden="true">
      <svg className="victory-arc" viewBox="0 0 100 100" preserveAspectRatio="none">
        <path d="M -8 84 Q 46 -18 108 44" pathLength="100" />
      </svg>
      {FIREWORKS.map((burst, burstIndex) => (
        <span
          className="pixel-firework"
          data-firework={burstIndex + 1}
          key={`${burst.left}:${burst.top}`}
          style={{ left: `${burst.left}%`, top: `${burst.top}%` }}
        >
          <span
            className="pixel-firework-core"
            style={{ "--spark-delay": `${burst.delay}ms` } as CSSProperties}
          />
          {SPARK_VECTORS.map(([x, y], sparkIndex) => (
            <span
              className="pixel-firework-spark"
              key={`${x}:${y}`}
              style={
                {
                  "--spark-x": `${x}px`,
                  "--spark-y": `${y}px`,
                  "--spark-delay": `${burst.delay + sparkIndex * 14}ms`,
                  "--spark-color": burst.colors[sparkIndex % burst.colors.length],
                } as CSSProperties
              }
            />
          ))}
        </span>
      ))}
    </div>
  );
}
