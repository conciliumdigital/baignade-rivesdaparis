import { CheckCircle2, AlertTriangle, XCircle, Smartphone, ShieldAlert, HelpCircle, ScanLine } from 'lucide-react';

export function AdminHelp() {
  return (
    <div className="max-w-3xl">
      <header className="mb-6">
        <h1 className="text-2xl font-display font-bold flex items-center gap-2">
          <HelpCircle className="w-6 h-6 text-brand-600" /> Aide — Scan des QR codes
        </h1>
        <p className="text-sm text-slate-600">Guide du contrôle d'accès à l'entrée de la zone de baignade.</p>
      </header>

      <section className="card p-6 mb-5">
        <h2 className="font-display font-bold mb-3 flex items-center gap-2"><Smartphone className="w-5 h-5 text-brand-600" /> Mettre en place le scan</h2>
        <ol className="list-decimal pl-5 space-y-2 text-sm text-slate-700">
          <li>L'agent se connecte une fois via le <strong>lien envoyé par e-mail</strong> (page Connexion) — aucun mot de passe.</li>
          <li>Un administrateur lui attribue le rôle <strong>Agent d'accueil</strong> dans l'onglet <strong>Équipe → Inviter un membre</strong>.</li>
          <li>Sur un téléphone, ouvrir <strong>l'adresse du site puis « /staff »</strong> et <strong>autoriser l'accès à la caméra</strong>.</li>
          <li>Présenter le QR code de l'usager au centre de l'écran : la vérification est automatique.</li>
        </ol>
      </section>

      <section className="card p-6 mb-5">
        <h2 className="font-display font-bold mb-3 flex items-center gap-2"><ScanLine className="w-5 h-5 text-brand-600" /> Que signifient les couleurs</h2>
        <div className="space-y-3 text-sm">
          <div className="flex gap-3 items-start">
            <span className="mt-0.5 inline-flex w-7 h-7 rounded-full bg-emerald-500 text-white items-center justify-center flex-shrink-0"><CheckCircle2 className="w-4 h-4" /></span>
            <div>
              <strong className="text-emerald-700">Vert — Accès autorisé.</strong> Laisser entrer et
              <strong> remettre le nombre de bracelets indiqué</strong> (durée 2 h). Un bip aigu + une
              vibration confirment ; le scan reprend automatiquement pour la personne suivante.
            </div>
          </div>
          <div className="flex gap-3 items-start">
            <span className="mt-0.5 inline-flex w-7 h-7 rounded-full bg-amber-500 text-white items-center justify-center flex-shrink-0"><AlertTriangle className="w-4 h-4" /></span>
            <div>
              <strong className="text-amber-700">Orange — Déjà utilisé.</strong> Le QR a déjà été scanné
              (l'écran indique la date/heure). <strong>Ne pas laisser entrer</strong> une seconde fois ;
              en cas de doute, vérifier la pièce d'identité ou appeler un responsable.
            </div>
          </div>
          <div className="flex gap-3 items-start">
            <span className="mt-0.5 inline-flex w-7 h-7 rounded-full bg-red-500 text-white items-center justify-center flex-shrink-0"><XCircle className="w-4 h-4" /></span>
            <div>
              <strong className="text-red-700">Rouge — Refusé.</strong> QR non reconnu, réservation
              annulée, ou créneau prévu un autre jour (le motif s'affiche). <strong>Ne pas laisser
              entrer</strong> ; orienter l'usager vers la réservation en ligne.
            </div>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-4">
          Sur un résultat orange ou rouge, l'écran reste affiché : touchez <em>« Scanner suivant »</em>
          quand vous avez traité le cas.
        </p>
      </section>

      <section className="card p-6 mb-5">
        <h2 className="font-display font-bold mb-3">Tarif Nocéen &amp; justificatif</h2>
        <p className="text-sm text-slate-700">
          Pour une réservation au <strong>tarif Nocéen</strong>, l'écran affiche un badge
          « Tarif Nocéen — Neuilly-sur-Marne » et un lien <strong>« Voir le justificatif de
          domicile »</strong>. En cas de contrôle, vous pouvez l'ouvrir. La mention
          <em> « Justificatif non joint »</em> signale une réservation Nocéen·ne sans pièce —
          à signaler à un responsable si nécessaire.
        </p>
      </section>

      <section className="card p-6">
        <h2 className="font-display font-bold mb-3 flex items-center gap-2"><ShieldAlert className="w-5 h-5 text-amber-600" /> Dépannage</h2>
        <ul className="space-y-2 text-sm text-slate-700">
          <li><strong>« Non autorisé » / « Authentification requise » :</strong> l'agent n'est pas connecté ou n'a pas le rôle Agent d'accueil. Le faire connecter via le lien e-mail, puis lui attribuer le rôle dans <strong>Équipe</strong>.</li>
          <li><strong>La caméra ne s'ouvre pas :</strong> autoriser la caméra dans le navigateur (le site doit être en HTTPS). Réessayer en rechargeant la page.</li>
          <li><strong>« Créneau prévu le … » :</strong> la réservation est valable un autre jour — accès refusé aujourd'hui.</li>
          <li><strong>Connexion instable :</strong> le scan nécessite Internet. En cas d'erreur réseau, réessayer ; en dernier recours, noter la référence et vérifier ensuite dans <strong>Réservations</strong>.</li>
          <li><strong>Compteur en haut à droite :</strong> nombre d'entrées validées depuis l'ouverture de la page (indicatif). L'historique complet est dans <strong>Historique</strong>.</li>
        </ul>
      </section>
    </div>
  );
}
