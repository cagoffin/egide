// Éditeur à la souris, à la manière d'un jeu de stratégie vu de dessus (jalon 3) : sélection au clic ou au rectangle,
// glisser pour déplacer, clic droit pour envoyer la sélection, groupes Ctrl+1–9, outils cible et plan de vol.
// Toute la logique vit dans edition.js ; ici, seulement les gestes et leur dessin.
import {COULEURS} from "./couleurs.js";
import {ecran, geo_depuis_ecran} from "./ecran.js";
import {
  barycentre, dans_rectangle, element_sous, elements_editables, modifications_ajout_cible, modifications_ajout_passage,
  modifications_deplacement, modifications_suppression, translater,
} from "./edition.js";

const TOUCHES_OUTILS = {s: "selection", c: "cible", p: "plan"};
// En deçà de 4 px, un appui est un clic, pas un glisser : on ne déplace rien par mégarde.
const SEUIL_GLISSER = 4;

/**
 * Rendre l'éditeur branché sur `env` : {vue, toile, barre, camera(), monde(), brut(), appliquer(modifs), annuler(),
 * panoramique(dx, dy), zoom(facteur, point), sur_activation(actif)}.
 */
export function creer_editeur(env) {
  const etat = {actif: false, outil: "selection", selection: [], groupes: {}, geste: null};
  const elements = () => elements_editables(env.monde(), env.brut());
  const vers_ecran = (geo) => ecran(env.camera(), geo);
  const local = (e) => {
    const cadre = env.vue.getBoundingClientRect();
    return {x: e.clientX - cadre.left, y: e.clientY - cadre.top};
  };

  function choisir_outil(outil) {
    etat.outil = outil;
    env.vue.dataset.outil = outil;
    env.barre.querySelectorAll("[data-outil]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.outil === outil)));
  }

  function activer(actif) {
    Object.assign(etat, {actif, selection: [], geste: null});
    env.vue.classList.toggle("edition", actif);
    env.barre.hidden = !actif;
    choisir_outil("selection");
    env.sur_activation(actif);
  }

  function commencer(e) {
    const p = local(e);
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      etat.geste = {type: "panoramique", dernier: p};
      return;
    }
    if (e.button !== 0) return;
    const geo = geo_depuis_ecran(env.camera(), p);
    if (etat.outil === "cible") return env.appliquer(modifications_ajout_cible(env.monde(), geo));
    if (etat.outil === "plan") return env.appliquer(modifications_ajout_passage(env.brut(), geo));
    const touche = element_sous(elements(), vers_ecran, p);
    if (touche) {
      if (!etat.selection.includes(touche.cle)) etat.selection = e.shiftKey ? [...etat.selection, touche.cle] : [touche.cle];
      etat.geste = {type: "glisser", depart: p, de: touche.geo, vers: touche.geo, deplace: false};
    } else {
      if (!e.shiftKey) etat.selection = [];
      etat.geste = {type: "rectangle", rectangle: {x0: p.x, y0: p.y, x1: p.x, y1: p.y}, ajout: e.shiftKey};
    }
  }

  function suivre(e) {
    const geste = etat.geste;
    if (!geste) return;
    const p = local(e);
    if (geste.type === "panoramique") {
      env.panoramique(p.x - geste.dernier.x, p.y - geste.dernier.y);
      geste.dernier = p;
    } else if (geste.type === "glisser") {
      geste.deplace ||= Math.hypot(p.x - geste.depart.x, p.y - geste.depart.y) > SEUIL_GLISSER;
      if (geste.deplace) geste.vers = geo_depuis_ecran(env.camera(), p);
    } else {
      Object.assign(geste.rectangle, {x1: p.x, y1: p.y});
    }
  }

  function terminer() {
    const geste = etat.geste;
    etat.geste = null;
    if (geste?.type === "glisser" && geste.deplace) {
      env.appliquer(modifications_deplacement(env.monde(), env.brut(), etat.selection, geste.de, geste.vers));
    } else if (geste?.type === "rectangle") {
      const cles = dans_rectangle(elements(), vers_ecran, geste.rectangle);
      etat.selection = geste.ajout ? [...new Set([...etat.selection, ...cles])] : cles;
    }
  }

  /** Envoyer la sélection au point visé : son barycentre y vient, la formation est conservée. */
  function envoyer(e) {
    const choisis = elements().filter((element) => etat.selection.includes(element.cle));
    if (!choisis.length) return;
    const vers = geo_depuis_ecran(env.camera(), local(e));
    env.appliquer(modifications_deplacement(env.monde(), env.brut(), etat.selection, barycentre(choisis.map((c) => c.geo)), vers));
  }

  function clavier(e) {
    if (!etat.actif || e.target.closest("input, select, textarea")) return;
    const commande = e.ctrlKey || e.metaKey;
    const chiffre = /^Digit([1-9])$/.exec(e.code)?.[1];
    if (e.key === "Escape") etat.outil === "selection" ? (etat.selection = []) : choisir_outil("selection");
    else if (e.key === "Delete" || e.key === "Backspace") {
      env.appliquer(modifications_suppression(env.monde(), env.brut(), etat.selection));
      etat.selection = [];
    } else if (commande && e.key.toLowerCase() === "z") env.annuler();
    else if (chiffre && commande) etat.groupes[chiffre] = [...etat.selection];
    else if (chiffre) etat.selection = [...(etat.groupes[chiffre] ?? [])];
    else if (!commande && TOUCHES_OUTILS[e.key.toLowerCase()]) choisir_outil(TOUCHES_OUTILS[e.key.toLowerCase()]);
    else return;
    e.preventDefault();
  }

  const si_actif = (fonction) => (e) => etat.actif && fonction(e);
  env.toile.addEventListener("pointerdown", si_actif((e) => {
    env.toile.setPointerCapture(e.pointerId);
    commencer(e);
  }));
  env.toile.addEventListener("pointermove", si_actif(suivre));
  env.toile.addEventListener("pointerup", si_actif(terminer));
  env.toile.addEventListener("contextmenu", si_actif((e) => {
    e.preventDefault();
    envoyer(e);
  }));
  env.toile.addEventListener("wheel", si_actif((e) => {
    e.preventDefault();
    env.zoom(e.deltaY < 0 ? 1.2 : 1 / 1.2, local(e));
  }), {passive: false});
  addEventListener("keydown", clavier);
  env.barre.addEventListener("click", (e) => {
    const bouton = e.target.closest("button");
    if (bouton?.dataset.outil) choisir_outil(bouton.dataset.outil);
    if (bouton?.dataset.action === "annuler_edition") env.annuler();
    if (bouton?.dataset.action === "terminer_edition") activer(false);
  });

  /** Dessiner le plan de vol (toujours) puis, en édition, la sélection, le fantôme du glisser et le rectangle. */
  function dessiner(ctx, camera, monde) {
    dessiner_plan(ctx, camera, monde);
    if (!etat.actif) return;
    const choisis = elements().filter((element) => etat.selection.includes(element.cle));
    const geste = etat.geste;
    ctx.strokeStyle = COULEURS.selection;
    ctx.lineWidth = 1.5;
    for (const element of choisis) {
      const p = ecran(camera, element.geo);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 12, 0, 2 * Math.PI);
      ctx.stroke();
      if (geste?.type === "glisser" && geste.deplace) {
        const q = ecran(camera, translater(element.geo, geste.de, geste.vers));
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(q.x, q.y);
        ctx.arc(q.x, q.y, 9, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    if (geste?.type === "rectangle") {
      const {x0, y0, x1, y1} = geste.rectangle;
      ctx.fillStyle = "rgba(242, 242, 242, 0.08)";
      ctx.fillRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
      ctx.strokeRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
    }
  }

  function dessiner_plan(ctx, camera, monde) {
    const {plan_de_vol: plan, comportement} = monde.scenario.rouge;
    if (!plan.length || !comportement.endsWith("plan_de_vol")) return;
    const points = plan.map((geo) => ecran(camera, geo));
    ctx.strokeStyle = COULEURS.hostile;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "center";
    points.forEach((p, i) => {
      ctx.fillStyle = COULEURS.fond;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 8, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = COULEURS.texte;
      ctx.fillText(String(i + 1), p.x, p.y + 4);
    });
    ctx.textAlign = "start";
  }

  return {activer, dessiner, est_actif: () => etat.actif};
}
