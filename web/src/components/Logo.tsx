export function Logo({ size = 34 }: { size?: number }) {
  const iconSize = Math.round(size * 0.58);
  return (
    <div className="logo" style={{ width: size, height: size }}>
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="#fbfaf7" fillRule="evenodd" aria-hidden="true">
        <path d="M12 21.8 9.3 17.6 4.6 15.2 6.2 11 3 3l5.2 4.4L12 6l3.8 1.4L21 3l-3.2 8 1.6 4.2-4.7 2.4ZM8.4 10.6 10.2 11.6 9.1 12.7 7.6 11.9Zm7.2 0-1.8 1 1.1 1.1 1.5-.8ZM12 16.4l1.1 1.6L12 19.1l-1.1-1.1Z" />
      </svg>
    </div>
  );
}

export function LogoWordmark() {
  return (
    <div className="logo-wordmark">
      <Logo />
      <span>Loboflix</span>
    </div>
  );
}
