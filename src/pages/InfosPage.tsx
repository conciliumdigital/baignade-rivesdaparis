import { Link } from 'react-router-dom';
import { MapPin, Clock, ShieldAlert, Sun, Wind, Heart } from 'lucide-react';

export function InfosPage() {
  return (
    <div className="container-app py-12 max-w-4xl">
      <h1 className="text-3xl md:text-4xl font-display font-bold mb-3">Informations pratiques</h1>
      <p className="text-slate-600 mb-10 max-w-2xl">
        Tout ce qu'il faut savoir avant de venir profiter de la zone de baignade aménagée par la Commune de Neuilly-sur-Marne.
      </p>

      <div className="grid md:grid-cols-2 gap-5 mb-10">
        <InfoCard icon={MapPin} title="Localisation">
          Berge de la Marne — entrée principale par le quai des Berges, à 5 min à pied du RER A station Neuilly-Plaisance.
        </InfoCard>
        <InfoCard icon={Clock} title="Horaires & saison">
          Ouvert du 1<sup>er</sup> juillet au 31 août, tous les jours de 10h à 20h. Créneaux fixes de 2 heures.
        </InfoCard>
        <InfoCard icon={ShieldAlert} title="Sécurité & encadrement">
          Surveillance assurée par des MNS BNSSA toute la journée. Trousses de premiers secours, défibrillateur, douches et vestiaires sur place.
        </InfoCard>
        <InfoCard icon={Sun} title="À apporter">
          Maillot de bain, serviette, crème solaire, bouteille d'eau. Casiers gratuits disponibles à l'entrée.
        </InfoCard>
        <InfoCard icon={Wind} title="Conditions météo">
          La baignade peut être suspendue en cas d'orage, vent violent ou qualité de l'eau dégradée.
          Vous serez prévenu par email avec une proposition de report ou de remboursement intégral.
        </InfoCard>
        <InfoCard icon={Heart} title="Accessibilité">
          Site accessible PMR : rampe d'accès, vestiaires adaptés, fauteuil hippocampe disponible sur demande.
        </InfoCard>
      </div>

      <section className="card p-8 mb-8">
        <h2 className="font-display font-bold text-xl mb-3">Tarifs été 2026</h2>
        <ul className="text-sm space-y-2">
          <li className="flex justify-between border-b border-slate-100 pb-2">
            <span>Adulte (Neuilléen)</span>
            <strong>3 €</strong>
          </li>
          <li className="flex justify-between border-b border-slate-100 pb-2">
            <span>Adulte (extérieur)</span>
            <strong>5 €</strong>
          </li>
          <li className="flex justify-between border-b border-slate-100 pb-2">
            <span>Enfant - 12 ans</span>
            <strong>2,50 €</strong>
          </li>
          <li className="flex justify-between">
            <span>Enfant - 4 ans</span>
            <strong>Gratuit</strong>
          </li>
        </ul>
      </section>

      <section className="card p-8 mb-8">
        <h2 className="font-display font-bold text-xl mb-3">Annulation & remboursement</h2>
        <p className="text-sm text-slate-600 leading-relaxed">
          Vous pouvez annuler ou modifier votre réservation jusqu'à <strong>24 heures avant le créneau</strong> depuis votre espace personnel.
          Au-delà de ce délai, la réservation reste due, sauf cas de force majeure (fermeture météo, problème sanitaire) où le remboursement est intégral et automatique.
        </p>
      </section>

      <div className="text-center">
        <Link to="/reserver" className="btn-primary btn-lg">Réserver un créneau</Link>
      </div>
    </div>
  );
}

function InfoCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card p-6">
      <div className="w-10 h-10 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center mb-3">
        <Icon className="w-5 h-5" />
      </div>
      <h3 className="font-display font-bold mb-1.5">{title}</h3>
      <p className="text-sm text-slate-600 leading-relaxed">{children}</p>
    </div>
  );
}
