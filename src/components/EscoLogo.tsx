export function EscoLogo({ size = 'lg' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'text-xl', md: 'text-2xl', lg: 'text-4xl' };
  return (
    <h1 className={`${sizes[size]} font-black tracking-tight select-none`}>
      <span className="text-text">Esco</span>
      <span className="text-brand">Express</span>
    </h1>
  );
}
