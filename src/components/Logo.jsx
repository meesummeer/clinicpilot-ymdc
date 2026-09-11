export default function Logo({ height = 34 }) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}assets/yaseen-logo.png`}
      alt="Yaseen Medical & Diagnostic Centre"
      style={{ height, display: 'block' }}
    />
  );
}
