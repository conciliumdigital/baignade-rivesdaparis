import { Link } from 'react-router-dom';
import { MapPin, Clock, ShieldAlert, Sun, Wind, Heart, Users, AlertTriangle } from 'lucide-react';

export function InfosPage() {
  return (
    <div className="container-app py-12 max-w-4xl">
      <h1 className="text-3xl md:text-4xl font-display font-bold mb-3">Informations pratiques</h1>
      <p className="text-slate-600 mb-10 max-w-2xl">
        Tout ce qu&apos;il faut savoir avant de venir profiter de la zone de baignade aménagée par la Commune de Neuilly-sur-Marne.
      </p>

      <div className="grid md:grid-cols-2 gap-5 mb-10">
        <InfoCard icon={MapPin} title="Localisation">
          Chemin de la Haute-Île, 93330 Neuilly-sur-Marne. À environ 20 minutes à pied du RER A.
        </InfoCard>
        <InfoCard icon={Clock} title="Horaires et saison">
          Ouvert du 4 juillet au 30 août. Créneaux fixes de 2 heures. Les horaires détaillés (semaine, week-end, jours fériés) seront publiés prochainement.
        </InfoCard>
        <InfoCard icon={ShieldAlert} title="Sécurité et encadrement">
          Poste de secours sur place pendant toute la durée d&apos;ouverture. La baignade est surveillée par des maîtres-nageurs sauveteurs habilités.
        </InfoCard>
        <InfoCard icon={Sun} title="À apporter">
          Maillot de bain, serviette, crème solaire, bouteille d&apos;eau.
        </InfoCard>
        <InfoCard icon={AlertTriangle} title="Affaires personnelles">
          <strong>Aucun casier n&apos;est mis à disposition.</strong> Chaque usager est responsable de ses effets personnels. Il est fortement déconseillé d&apos;apporter des objets de valeur.
        </InfoCard>
        <InfoCard icon={Wind} title="Conditions météo">
          La baignade peut être suspendue en cas d&apos;orage, de vent violent ou de qualité de l&apos;eau dégradée. <strong>Aucun remboursement n&apos;est effectué</strong> mais un report sur un autre créneau vous sera proposé.
        </InfoCard>
        <InfoCard icon={Heart} title="Accessibilité">
          Mise à l&apos;eau adaptée pour les personnes à mobilité réduite. Pour toute demande particulière, contactez la mairie.
        </InfoCard>
        <InfoCard icon={Users} title="Inauguration — 4 juillet">
          Cérémonie d&apos;inauguration de 14 h à 16 h. La baignade ouvre officiellement après ; le premier créneau réservable est celui de <strong>16 h</strong>.
        </InfoCard>
      </div>

      <section className="card p-8 mb-8">
        <h2 className="font-display font-bold text-xl mb-3">Tarifs été 2026</h2>
        <ul className="text-sm space-y-2">
          <li className="flex justify-between border-b border-slate-100 pb-2">
            <span>Nocéen (habitant de Neuilly-sur-Marne)</span>
            <strong>2 €</strong>
          </li>
          <li className="flex justify-between border-b border-slate-100 pb-2">
            <span>Extérieur</span>
            <strong>5 €</strong>
          </li>
          <li className="flex justify-between">
            <span>Groupe (à partir de 10 personnes)</span>
            <strong>3 € par personne</strong>
          </li>
        </ul>
        <p className="text-xs text-slate-500 mt-3">
          Le tarif Nocéen est conditionné à la présentation d&apos;un justificatif de domicile et à une déclaration sur l&apos;honneur lors de la réservation.
        </p>
      </section>

      <section className="card p-8 mb-8">
        <h2 className="font-display font-bold text-xl mb-3">Annulation et remboursement</h2>
        <p className="text-sm text-slate-600 leading-relaxed mb-2">
          <strong>Aucun remboursement n&apos;est effectué en cas d&apos;annulation.</strong> Vous pouvez néanmoins
          annuler votre réservation depuis votre espace personnel afin de libérer la place pour les
          personnes en liste d&apos;attente.
        </p>
        <p className="text-sm text-slate-600 leading-relaxed">
          En cas de fermeture pour raisons météo ou sanitaires, un <strong>report</strong> sur un autre
          créneau vous sera proposé par courriel.
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
        <Icon className="w-5 h-5" aria-hidden="true" />
      </div>
      <h3 className="font-display font-bold mb-1.5">{title}</h3>
      <p className="text-sm text-slate-600 leading-relaxed">{children}</p>
    </div>
  );
}
