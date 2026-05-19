import { formatPrice } from '../lib/format';

// Affiche un montant (en centimes) avec une petite transition à chaque
// changement de valeur. Le `key` force le remount → l'animation rejoue.
// Respecte « réduire les animations » (CSS global neutralise l'anim).
export function AnimatedPrice({
  cents,
  className = '',
}: {
  cents: number;
  className?: string;
}) {
  const value = formatPrice(cents);
  return (
    <span key={value} className={`inline-block animate-price-pop ${className}`}>
      {value}
    </span>
  );
}
