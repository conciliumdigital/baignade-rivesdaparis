// Pages légales : CGU, Confidentialité, Mentions légales, Accessibilité
// Contenu de base RGPD-compliant à compléter par la Commune avant mise en prod.

function LegalLayout({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="container-app py-12 max-w-3xl prose prose-slate">
      <h1 className="text-3xl md:text-4xl font-display font-bold mb-2">{title}</h1>
      <p className="text-slate-500 text-sm mb-8">
        Dernière mise à jour : {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
      </p>
      <div className="space-y-4 text-sm leading-relaxed text-slate-700">{children}</div>
    </div>
  );
}

export function CguPage() {
  return (
    <LegalLayout title="Conditions générales d'utilisation">
      <h2 className="font-display font-bold text-lg mt-6">1. Objet</h2>
      <p>
        Les présentes CGU régissent l'usage du service de réservation en ligne de la zone de baignade estivale, exploité par la Commune de Neuilly-sur-Marne.
      </p>
      <h2 className="font-display font-bold text-lg mt-6">2. Réservation</h2>
      <p>
        Toute réservation est nominative, payante et soumise à confirmation après paiement. Une réservation correspond à un créneau de 2 heures. Le QR code reçu par email permet l'accès à la zone de baignade pour les personnes inscrites.
      </p>
      <h2 className="font-display font-bold text-lg mt-6">3. Annulation et remboursement</h2>
      <p>
        L'annulation est possible jusqu'à 24 heures avant le créneau réservé, depuis l'espace personnel de l'utilisateur. Au-delà, aucun remboursement ne pourra être accordé sauf cas de force majeure (fermeture météo, problème sanitaire) où le remboursement est automatique.
      </p>
      <h2 className="font-display font-bold text-lg mt-6">4. Comportement et règlement intérieur</h2>
      <p>
        L'accès à la zone de baignade implique le respect du règlement intérieur affiché sur site. La Commune se réserve le droit d'exclure tout usager dont le comportement compromettrait la sécurité ou la tranquillité des autres baigneurs.
      </p>
      <h2 className="font-display font-bold text-lg mt-6">5. Responsabilité</h2>
      <p>
        La Commune décline toute responsabilité en cas de vol, perte ou dégradation d'objets personnels. La baignade s'effectue sous la responsabilité parentale pour les mineurs.
      </p>
    </LegalLayout>
  );
}

export function PrivacyPage() {
  return (
    <LegalLayout title="Politique de confidentialité">
      <p>
        La Commune de Neuilly-sur-Marne s'engage à protéger la vie privée des utilisateurs du service baignade.lesrivesdeparis.fr conformément au Règlement Général sur la Protection des Données (RGPD) et à la loi Informatique et Libertés.
      </p>
      <h2 className="font-display font-bold text-lg mt-6">Responsable de traitement</h2>
      <p>Mairie de Neuilly-sur-Marne — Place Ferdinand Buisson, 93330 Neuilly-sur-Marne.</p>
      <h2 className="font-display font-bold text-lg mt-6">Données collectées</h2>
      <ul className="list-disc pl-5 space-y-1">
        <li>Identité : nom, prénom</li>
        <li>Contact : email, téléphone (facultatif)</li>
        <li>Réservations : créneaux, paiement, statut</li>
        <li>Cookies strictement nécessaires (session, panier)</li>
      </ul>
      <h2 className="font-display font-bold text-lg mt-6">Finalités</h2>
      <ul className="list-disc pl-5 space-y-1">
        <li>Gestion des réservations et des paiements</li>
        <li>Envoi de notifications transactionnelles (confirmation, rappel, annulation)</li>
        <li>Statistiques d'usage anonymisées</li>
      </ul>
      <h2 className="font-display font-bold text-lg mt-6">Hébergement</h2>
      <p>
        Les données sont hébergées en Union européenne (Supabase — région Europe). Aucun transfert hors UE.
      </p>
      <h2 className="font-display font-bold text-lg mt-6">Durée de conservation</h2>
      <p>
        Données de réservation : 13 mois après le créneau. Compte utilisateur : jusqu'à demande de suppression.
      </p>
      <h2 className="font-display font-bold text-lg mt-6">Vos droits</h2>
      <p>
        Vous disposez d'un droit d'accès, de rectification, d'opposition, de portabilité et de suppression. Pour les exercer : depuis votre espace personnel, ou par email à <a href="mailto:dpo@neuillysurmarne.fr">dpo@neuillysurmarne.fr</a>.
      </p>
    </LegalLayout>
  );
}

export function MentionsLegalesPage() {
  return (
    <LegalLayout title="Mentions légales">
      <h2 className="font-display font-bold text-lg mt-6">Éditeur</h2>
      <p>Mairie de Neuilly-sur-Marne — Place Ferdinand Buisson, 93330 Neuilly-sur-Marne.</p>
      <h2 className="font-display font-bold text-lg mt-6">Directeur de la publication</h2>
      <p>Le Maire de Neuilly-sur-Marne.</p>
      <h2 className="font-display font-bold text-lg mt-6">Conception & développement</h2>
      <p>CONCILIUM — solution numérique de réservation.</p>
      <h2 className="font-display font-bold text-lg mt-6">Hébergement</h2>
      <p>Supabase (région UE) — Stripe (paiement, conformité PCI DSS).</p>
    </LegalLayout>
  );
}

export function AccessibilityPage() {
  return (
    <LegalLayout title="Déclaration d'accessibilité">
      <p>
        La Commune de Neuilly-sur-Marne s'engage à rendre ce service accessible conformément à l'article 47 de la loi n°2005-102 du 11 février 2005 et au Référentiel Général d'Amélioration de l'Accessibilité (RGAA 4.1).
      </p>
      <h2 className="font-display font-bold text-lg mt-6">État de conformité</h2>
      <p>
        Le service vise un niveau de conformité <strong>partiellement conforme</strong> au RGAA 4.1 niveau AA. Un audit complet sera réalisé après mise en production.
      </p>
      <h2 className="font-display font-bold text-lg mt-6">Retour utilisateur</h2>
      <p>
        Si vous rencontrez un défaut d'accessibilité, contactez-nous à <a href="mailto:accessibilite@neuillysurmarne.fr">accessibilite@neuillysurmarne.fr</a>.
      </p>
    </LegalLayout>
  );
}
