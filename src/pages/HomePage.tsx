import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Calendar, ShieldCheck, QrCode, MapPin, Clock, Users, ArrowRight } from 'lucide-react';
import { Reveal } from '../components/Reveal';

export function HomePage() {
  // Vidéo de fond : desktop uniquement et hors « réduire les animations »
  // (mobile / data-saver → fond sobre, ~6,5 Mo économisés, LCP préservé).
  const [showHeroVideo, setShowHeroVideo] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const wideEnough = window.matchMedia('(min-width: 768px)').matches;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setShowHeroVideo(wideEnough && !reducedMotion);
  }, []);

  return (
    <>
      {/* ── Hero éditorial ───────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-brand-900 text-white">
        {showHeroVideo && (
          <video
            className="absolute inset-0 w-full h-full object-cover"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            aria-hidden="true"
            tabIndex={-1}
          >
            <source src="/hero-baignade.mp4" type="video/mp4" />
          </video>
        )}
        {/* Voile sobre (un seul ton) pour la lisibilité */}
        <div className="absolute inset-0 bg-brand-950/60" aria-hidden="true" />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-900 via-brand-900/20 to-transparent" aria-hidden="true" />

        <div className="container-app relative z-10 py-24 md:py-36 max-w-3xl">
          <p className="text-xs uppercase tracking-[0.22em] text-brand-200 mb-5 animate-fade-up">
            Ville de Neuilly-sur-Marne · Été 2026
          </p>
          <h1
            className="text-4xl md:text-6xl font-display font-semibold leading-[1.05] mb-6 animate-fade-up"
            style={{ animationDelay: '60ms' }}
          >
            La baignade en bord de Marne,
            <br className="hidden md:inline" /> sur réservation.
          </h1>
          <p
            className="text-lg text-white/85 leading-relaxed mb-9 max-w-xl animate-fade-up"
            style={{ animationDelay: '120ms' }}
          >
            Réservez votre créneau dans la zone de baignade estivale aménagée par
            la Commune. Calendrier en temps réel, paiement sécurisé, accès par
            QR code à présenter sur place.
          </p>
          <div className="flex flex-wrap gap-3 animate-fade-up" style={{ animationDelay: '180ms' }}>
            <Link to="/reserver" className="btn-primary btn-lg bg-white text-brand-800 hover:bg-brand-50">
              <Calendar className="w-5 h-5" /> Voir les créneaux
            </Link>
            <Link to="/infos-pratiques" className="btn-lg btn bg-transparent border border-white/35 text-white hover:bg-white/10">
              Informations pratiques
            </Link>
          </div>

          <div
            className="mt-14 flex flex-wrap gap-x-10 gap-y-3 text-sm text-white/80 border-t border-white/15 pt-6 animate-fade-up"
            style={{ animationDelay: '240ms' }}
          >
            <span className="inline-flex items-center gap-2"><MapPin className="w-4 h-4 text-brand-200" /> Berge de la Marne</span>
            <span className="inline-flex items-center gap-2"><Clock className="w-4 h-4 text-brand-200" /> Juillet &amp; août</span>
            <span className="inline-flex items-center gap-2"><Users className="w-4 h-4 text-brand-200" /> Encadré par des maîtres-nageurs</span>
          </div>
        </div>
      </section>

      {/* ── Étapes ───────────────────────────────────────────────── */}
      <section className="container-app py-24">
        <Reveal>
          <p className="text-xs uppercase tracking-[0.2em] text-brand-700 mb-3">Comment ça marche</p>
          <h2 className="text-3xl md:text-4xl font-display font-semibold mb-12 max-w-xl">
            Réserver prend moins de trois minutes.
          </h2>
        </Reveal>

        <div className="grid md:grid-cols-3 gap-x-10 gap-y-12">
          {[
            { n: '01', icon: Calendar, title: 'Choisissez votre créneau', desc: "Le calendrier affiche en temps réel les places restantes pour chaque créneau de deux heures." },
            { n: '02', icon: ShieldCheck, title: 'Payez en toute sécurité', desc: 'Paiement en ligne par carte bancaire. La commune ne conserve aucune coordonnée bancaire.' },
            { n: '03', icon: QrCode, title: 'Présentez votre QR code', desc: "Reçu instantanément par e-mail, scanné à l'entrée — validation en moins d'une seconde." },
          ].map((s, i) => (
            <Reveal key={s.n} delay={i * 90}>
              <div className="border-t-2 border-slate-900 pt-5">
                <div className="flex items-center justify-between mb-4">
                  <span className="font-display text-3xl text-slate-300">{s.n}</span>
                  <s.icon className="w-5 h-5 text-brand-700" />
                </div>
                <h3 className="font-display text-xl font-semibold mb-2">{s.title}</h3>
                <p className="text-slate-600 text-sm leading-relaxed">{s.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Engagements ──────────────────────────────────────────── */}
      <section className="bg-white border-y border-slate-100">
        <div className="container-app py-24 grid md:grid-cols-2 gap-x-16 gap-y-10 items-start">
          <Reveal>
            <p className="text-xs uppercase tracking-[0.2em] text-brand-700 mb-3">Un service public</p>
            <h2 className="text-3xl md:text-4xl font-display font-semibold mb-5 leading-tight">
              Pensé pour les Nocéens, ouvert à tous.
            </h2>
            <p className="text-slate-600 leading-relaxed">
              La zone de baignade aménagée par la Commune de Neuilly-sur-Marne
              accueille petits et grands de juillet à août, avec un encadrement
              professionnel. La réservation préalable garantit fluidité,
              sécurité et qualité de service.
            </p>
          </Reveal>
          <Reveal delay={120}>
            <ul className="divide-y divide-slate-100 border-y border-slate-100">
              {[
                'Tarif préférentiel pour les habitants de Neuilly-sur-Marne',
                'Créneaux dédiés aux groupes et aux écoles en semaine',
                "Annulation gratuite jusqu'à 24 heures avant le créneau",
                'Notification automatique en cas de fermeture météo',
                'Service accessible aux personnes en situation de handicap',
              ].map((b) => (
                <li key={b} className="flex items-start gap-3 py-3.5">
                  <ArrowRight className="w-4 h-4 text-brand-600 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-slate-700">{b}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* ── Appel final ──────────────────────────────────────────── */}
      <section className="container-app py-24">
        <Reveal>
          <div className="rounded-2xl bg-brand-900 text-white px-8 py-14 md:px-16 md:py-20 text-center card-hover">
            <h2 className="text-3xl md:text-4xl font-display font-semibold mb-4">Prêt à plonger&nbsp;?</h2>
            <p className="text-white/80 max-w-xl mx-auto mb-8">
              Les créneaux sont publiés tout l'été. Réservez le vôtre dès maintenant.
            </p>
            <Link to="/reserver" className="btn-primary btn-lg bg-white text-brand-800 hover:bg-brand-50">
              Réserver mon créneau <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </Reveal>
      </section>
    </>
  );
}
