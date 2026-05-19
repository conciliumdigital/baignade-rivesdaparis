import { Link } from 'react-router-dom';
import { Calendar, Smartphone, ShieldCheck, QrCode, MapPin, Clock, Users, Sparkles } from 'lucide-react';

export function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 text-white">
        {/* Vidéo de fond (décorative, muette, en boucle) */}
        <video
          className="absolute inset-0 w-full h-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden="true"
          tabIndex={-1}
        >
          <source src="/hero-baignade.mp4" type="video/mp4" />
        </video>
        {/* Voile pour garantir la lisibilité du texte par-dessus la vidéo */}
        <div
          className="absolute inset-0 bg-gradient-to-br from-brand-800/80 via-brand-800/70 to-brand-900/85"
          aria-hidden="true"
        />

        <div className="absolute inset-0 opacity-20" aria-hidden="true">
          <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 1200 600" fill="none">
            <path d="M0 400 C 200 350 400 450 600 400 S 1000 350 1200 400 L 1200 600 L 0 600 Z" fill="white" fillOpacity=".08" />
            <path d="M0 450 C 200 400 400 500 600 450 S 1000 400 1200 450 L 1200 600 L 0 600 Z" fill="white" fillOpacity=".06" />
          </svg>
        </div>

        <div className="container-app relative z-10 py-20 md:py-28 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <span className="badge bg-white/15 text-white border border-white/20 mb-5">
              <Sparkles className="w-3.5 h-3.5" /> Été 2026 — Réservation en ligne
            </span>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-extrabold leading-tight mb-5">
              Plongez dans l'été <br className="hidden md:inline" />
              <span className="text-sand-200">à Neuilly-sur-Marne</span>
            </h1>
            <p className="text-lg text-brand-50/90 leading-relaxed mb-8 max-w-xl">
              Réservez votre créneau de baignade dans la zone estivale aménagée par la Commune.
              Calendrier en temps réel, paiement sécurisé, QR code à présenter sur place. C'est tout.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/reserver" className="btn-primary btn-lg bg-white text-brand-700 hover:bg-brand-50">
                <Calendar className="w-5 h-5" /> Voir les créneaux
              </Link>
              <Link to="/infos-pratiques" className="btn-lg btn bg-transparent border border-white/30 text-white hover:bg-white/10">
                Infos pratiques
              </Link>
            </div>

            <div className="mt-10 grid grid-cols-3 gap-4 text-sm">
              <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-sand-300" /> Berge de la Marne</div>
              <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-sand-300" /> Juillet & août</div>
              <div className="flex items-center gap-2"><Users className="w-4 h-4 text-sand-300" /> Encadré & sécurisé</div>
            </div>
          </div>

          <div className="relative">
            <div className="card p-6 bg-white/95 backdrop-blur text-slate-800 max-w-md mx-auto md:ml-auto">
              <div className="flex items-center justify-between mb-4">
                <div className="font-display font-bold text-lg">Aujourd'hui</div>
                <span className="badge-success">3 créneaux dispo</span>
              </div>
              <ul className="space-y-2.5">
                {[
                  { time: '10h00 – 12h00', remaining: 12, total: 50 },
                  { time: '12h00 – 14h00', remaining: 4, total: 50 },
                  { time: '14h00 – 16h00', remaining: 0, total: 50 },
                  { time: '16h00 – 18h00', remaining: 28, total: 50 },
                ].map((s) => (
                  <li
                    key={s.time}
                    className={`flex items-center justify-between rounded-xl border px-4 py-2.5 ${
                      s.remaining === 0 ? 'border-slate-200 bg-slate-50 text-slate-400' : 'border-brand-100 bg-brand-50/40'
                    }`}
                  >
                    <span className="font-medium">{s.time}</span>
                    {s.remaining === 0 ? (
                      <span className="text-xs">Complet</span>
                    ) : (
                      <span className="text-xs font-semibold text-brand-700">{s.remaining} places</span>
                    )}
                  </li>
                ))}
              </ul>
              <Link to="/reserver" className="btn-primary w-full mt-5 justify-center">Réserver maintenant</Link>
            </div>
          </div>
        </div>
      </section>

      {/* Étapes */}
      <section className="container-app py-20">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl md:text-4xl font-display font-bold mb-3">Réservation en 3 minutes</h2>
          <p className="text-slate-600">Un parcours simple, accessible depuis votre mobile.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: Calendar, title: '1 · Choisissez votre créneau', desc: "Calendrier en temps réel avec le nombre de places restantes pour chaque créneau de 2 heures." },
            { icon: ShieldCheck, title: '2 · Payez en toute sécurité', desc: 'Paiement par carte bancaire, Apple Pay ou Google Pay via Stripe. Conformité PCI DSS garantie.' },
            { icon: QrCode, title: '3 · Présentez votre QR code', desc: 'Reçu instantanément par email. Scanné à l\'entrée, validation en moins d\'une seconde.' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="card p-6">
              <div className="w-12 h-12 rounded-xl bg-brand-100 text-brand-700 flex items-center justify-center mb-4">
                <Icon className="w-6 h-6" />
              </div>
              <h3 className="font-display font-bold text-lg mb-1.5">{title}</h3>
              <p className="text-slate-600 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Avantages */}
      <section className="bg-white border-y border-slate-100">
        <div className="container-app py-20 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">Conçu pour vous simplifier l'été</h2>
            <p className="text-slate-600 leading-relaxed mb-6">
              La zone de baignade aménagée par la Commune de Neuilly-sur-Marne accueille petits et grands de juillet à août, avec un encadrement professionnel.
              Le système de réservation préalable garantit fluidité, sécurité et qualité de service.
            </p>
            <ul className="space-y-3 text-sm">
              {[
                'Tarif préférentiel pour les habitants de Neuilly-sur-Marne',
                'Créneaux dédiés aux groupes et écoles en semaine',
                'Annulation gratuite jusqu\'à 24h avant le créneau',
                'Notification automatique en cas de fermeture météo',
                'Accessibilité conforme RGAA niveau AA',
              ].map((b) => (
                <li key={b} className="flex items-start gap-2">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-brand-500 flex-shrink-0" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="card p-5">
              <Smartphone className="w-7 h-7 text-brand-600 mb-2" />
              <div className="font-bold text-2xl">100%</div>
              <div className="text-xs text-slate-500">Mobile-first</div>
            </div>
            <div className="card p-5">
              <ShieldCheck className="w-7 h-7 text-brand-600 mb-2" />
              <div className="font-bold text-2xl">PCI DSS</div>
              <div className="text-xs text-slate-500">Paiement sécurisé Stripe</div>
            </div>
            <div className="card p-5">
              <QrCode className="w-7 h-7 text-brand-600 mb-2" />
              <div className="font-bold text-2xl">&lt; 1s</div>
              <div className="text-xs text-slate-500">Validation à l'entrée</div>
            </div>
            <div className="card p-5">
              <Sparkles className="w-7 h-7 text-brand-600 mb-2" />
              <div className="font-bold text-2xl">RGPD</div>
              <div className="text-xs text-slate-500">Hébergement UE</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="container-app py-20 text-center">
        <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">Prêt à plonger ?</h2>
        <p className="text-slate-600 max-w-xl mx-auto mb-7">
          Les créneaux sont publiés tout l'été. Réservez le vôtre dès maintenant.
        </p>
        <Link to="/reserver" className="btn-primary btn-lg">Réserver mon créneau</Link>
      </section>
    </>
  );
}
