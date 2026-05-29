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
        <strong>Aucun remboursement n&apos;est effectué en cas d&apos;annulation, quelle qu&apos;en soit la raison.</strong> L&apos;usager peut toutefois annuler sa réservation depuis son espace personnel afin de libérer la place pour les personnes en liste d&apos;attente.
      </p>
      <p>
        En cas de fermeture pour raisons météo ou sanitaires décidée par la commune, un <strong>report</strong> sur un autre créneau de la saison est proposé par courriel. Aucun remboursement n&apos;est versé dans ce cas non plus.
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
      <p>Mairie de Neuilly-sur-Marne, 1 place François Mitterrand, 93330 Neuilly-sur-Marne.</p>
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
        Les données sont hébergées en Union européenne (Supabase, région Europe). Aucun transfert hors UE.
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
      <p>Mairie de Neuilly-sur-Marne, 1 place François Mitterrand, 93330 Neuilly-sur-Marne.</p>
      <h2 className="font-display font-bold text-lg mt-6">Directeur de la publication</h2>
      <p>Le Maire de Neuilly-sur-Marne.</p>
      <h2 className="font-display font-bold text-lg mt-6">Conception & développement</h2>
      <p>CONCILIUM, solution numérique de réservation.</p>
      <h2 className="font-display font-bold text-lg mt-6">Hébergement</h2>
      <p>
        Données hébergées dans l'Union européenne. Les paiements par carte
        bancaire sont opérés par un prestataire de paiement spécialisé,
        certifié aux standards internationaux de sécurité des paiements.
        La commune ne conserve aucune coordonnée bancaire.
      </p>
    </LegalLayout>
  );
}

export function AccessibilityPage() {
  // Modèle de Déclaration d'accessibilité conforme au RGAA 4.1 et au
  // décret n°2019-768 du 24 juillet 2019. Plan calé sur le modèle DINUM
  // (numerique.gouv.fr/publications/rgaa-accessibilite/methode/declaration/).
  return (
    <LegalLayout title="Déclaration d'accessibilité">
      <p>
        La Commune de Neuilly-sur-Marne s&apos;engage à rendre ce service accessible
        conformément à l&apos;article 47 de la loi n°&nbsp;2005-102 du 11&nbsp;février&nbsp;2005
        et au décret n°&nbsp;2019-768 du 24&nbsp;juillet&nbsp;2019 relatif à l&apos;accessibilité
        aux personnes handicapées des services de communication au public en ligne.
      </p>
      <p>
        Cette déclaration d&apos;accessibilité s&apos;applique au site
        <strong> baignade.lesrivesdeparis.fr</strong>.
      </p>

      <h2 className="font-display font-bold text-lg mt-6">État de conformité</h2>
      <p>
        Le service <strong>baignade.lesrivesdeparis.fr</strong> est
        <strong> non conforme</strong> au RGAA 4.1 niveau AA. L&apos;audit initial
        n&apos;a pas encore été réalisé ; les non-conformités identifiées par
        l&apos;audit interne de mai&nbsp;2026 sont en cours de correction. Un audit
        externe complet est planifié avant l&apos;ouverture publique du service
        (4&nbsp;juillet&nbsp;2026).
      </p>

      <h2 className="font-display font-bold text-lg mt-6">Résultats des tests</h2>
      <p>
        Aucun audit externe formel n&apos;a encore été conduit. Les contrôles
        internes (audit&nbsp;2026-05) ont identifié des non-conformités sur
        les critères suivants :
      </p>
      <ul className="list-disc pl-5 space-y-1">
        <li>RGAA&nbsp;3, Couleurs : vérification du contraste de la couleur d&apos;accent jaune en cours.</li>
        <li>RGAA&nbsp;4, Multimédia : la vidéo de présentation est décorative et muette (un bouton pause est disponible).</li>
        <li>RGAA&nbsp;7, Scripts : alternative manuelle au scan QR proposée pour les usagers sans caméra.</li>
        <li>RGAA&nbsp;11, Formulaires : regroupement sémantique et messages d&apos;erreur reliés en cours d&apos;amélioration.</li>
        <li>RGAA&nbsp;12, Navigation : plan du site à venir.</li>
      </ul>

      <h2 className="font-display font-bold text-lg mt-6">Contenus non accessibles</h2>
      <h3 className="font-display font-bold text-base mt-4">Non-conformités</h3>
      <ul className="list-disc pl-5 space-y-1">
        <li>Certains formulaires ne disposent pas encore d&apos;un regroupement sémantique complet (<code>fieldset</code> / <code>legend</code>).</li>
        <li>Le plan du site est en cours de réalisation.</li>
      </ul>
      <h3 className="font-display font-bold text-base mt-4">Dérogations pour charge disproportionnée</h3>
      <p>Aucune dérogation invoquée à ce jour.</p>
      <h3 className="font-display font-bold text-base mt-4">Contenus non soumis à l&apos;obligation d&apos;accessibilité</h3>
      <p>
        Le justificatif de domicile téléversé par l&apos;usager n&apos;est pas
        retraité par la commune ; il est consulté uniquement par les agents
        d&apos;accueil lors du contrôle d&apos;accès et n&apos;est jamais rediffusé en ligne.
      </p>

      <h2 className="font-display font-bold text-lg mt-6">Établissement de la déclaration</h2>
      <p>
        Cette déclaration a été établie le <strong>28&nbsp;mai&nbsp;2026</strong> sur
        la base d&apos;une auto-évaluation interne (mai&nbsp;2026). Elle sera mise à
        jour à l&apos;issue de l&apos;audit externe planifié avant l&apos;ouverture publique.
      </p>
      <p>
        Technologies utilisées pour la réalisation du site : HTML5, CSS, JavaScript
        (React, TypeScript, Tailwind&nbsp;CSS).
      </p>
      <p>
        Outils d&apos;évaluation prévus : auto-évaluation manuelle (clavier,
        lecteur d&apos;écran VoiceOver / NVDA), inspection des contrastes
        (WCAG&nbsp;Color Contrast Checker), validation HTML&nbsp;(W3C).
      </p>

      <h2 className="font-display font-bold text-lg mt-6">Retour d&apos;information et contact</h2>
      <p>
        Si vous n&apos;arrivez pas à accéder à un contenu ou à un service de ce
        site, vous pouvez nous contacter pour être orienté vers une alternative
        accessible ou obtenir le contenu sous une autre forme.
      </p>
      <ul className="list-disc pl-5 space-y-1">
        <li>Courriel : <a href="mailto:accessibilite@neuillysurmarne.fr">accessibilite@neuillysurmarne.fr</a></li>
        <li>Adresse postale : Mairie de Neuilly-sur-Marne, 1&nbsp;place François&nbsp;Mitterrand, 93330 Neuilly-sur-Marne.</li>
      </ul>

      <h2 className="font-display font-bold text-lg mt-6">Voies de recours</h2>
      <p>
        Cette procédure est à utiliser dans le cas suivant : vous avez signalé
        au responsable du site internet un défaut d&apos;accessibilité qui vous
        empêche d&apos;accéder à un contenu ou à un service, et vous n&apos;avez pas
        obtenu de réponse satisfaisante.
      </p>
      <ul className="list-disc pl-5 space-y-1">
        <li>
          Écrire un message au Défenseur des droits&nbsp;:{' '}
          <a href="https://formulaire.defenseurdesdroits.fr/" rel="noopener noreferrer" target="_blank">
            formulaire.defenseurdesdroits.fr
          </a>
        </li>
        <li>
          Contacter le délégué du Défenseur des droits dans votre région&nbsp;:{' '}
          <a href="https://www.defenseurdesdroits.fr/saisir/delegues" rel="noopener noreferrer" target="_blank">
            defenseurdesdroits.fr/saisir/delegues
          </a>
        </li>
        <li>Envoyer un courrier (gratuit, sans timbre) au Défenseur des droits, 7&nbsp;rue Saint-Florentin, 75409 Paris&nbsp;Cedex&nbsp;08.</li>
      </ul>
    </LegalLayout>
  );
}
