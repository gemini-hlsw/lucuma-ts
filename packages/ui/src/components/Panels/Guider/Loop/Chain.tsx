export function ConnectedChain() {
  return (
    <svg viewBox="0 0 45 90" fillOpacity={0} strokeWidth={3}>
      <path d="M7 5h10q5 0 5 5v20m0 30v20q0 5-5 5H2" />
      <path d="M12 45V25q0-5 5-5h10q5 0 5 5v20m0 0v20q0 5-5 5H17q-5 0-5-5V45" />
    </svg>
  );
}

export function BrokenChain() {
  return (
    <svg viewBox="0 0 45 90" fillOpacity={0} strokeWidth={3}>
      <path d="M7 5h10q5 0 5 5v20m0 30v20q0 5-5 5H2" />
      <path d="M12 40V25q0-5 5-5h10q5 0 5 5v15m0 10v15q0 5-5 5H17q-5 0-5-5V50M5 40l-5-5m5 15-5 5m39-15 5-5m-5 15 5 5" />
    </svg>
  );
}
