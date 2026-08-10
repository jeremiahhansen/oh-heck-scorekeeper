interface StepperProps {
  value: number;
  max: number;
  min?: number;
  onChange: (value: number) => void;
  /** Describes the number being changed, e.g. "Tricks bid for Jan". */
  label: string;
}

/**
 * Minus/plus number picker. Deliberately not a text input: tapping through
 * 0..cardsDealt keeps the iOS keyboard off the screen during a live game.
 */
export function Stepper({ value, max, min = 0, onChange, label }: StepperProps) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label={`Decrease ${label}`}
      >
        &minus;
      </button>
      <span className="value">{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label={`Increase ${label}`}
      >
        +
      </button>
    </div>
  );
}
