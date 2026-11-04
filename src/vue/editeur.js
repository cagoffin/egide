// Éditeur à la souris, à la manière d'un jeu de stratégie vu de dessus (jalon 3) : sélection au clic ou au rectangle,
// glisser pour déplacer, clic droit pour envoyer la sélection, groupes Ctrl+1–9, outils cible et plan de vol.
// Toute la logique vit dans edition.js ; ici, seulement les gestes et leur dessin.
import {COULEURS} from "./couleurs.js";
import {ecran, geo_depuis_ecran} from "./ecran.js";
import {
  barycentre, dans_rectangle, element_sous, elements_editables, modifications_ajout_cible, modifications_ajout_passage,
  modifications_ajout_centre, modifications_ajout_liaison, modifications_ajout_radar, modifications_panne, modifications_ajout_zone, modifications_reseau_complet, noeud_element, modifications_deplacement, modifications_ordre, modifications_suppression, translater,
} from "./edition.js";
import {element_visible} from "./calques.js";
import {modifications_depot} from "./deploiement.js";
import {format_duree} from "./format.js";

const TOUCHES_OUTILS = {s: "selection", c: "cible", r: "radar", k: "centre", l: "liaison", p: "plan", z: "zone"};
// En deçà de 4 px, un appui est un clic, pas un glisser : on ne déplace rien par mégarde.
const SEUIL_GLISSER = 4;

/**
 * Rendre l'éditeur branché sur `env` : {vue, toile, barre, camera(), monde(), brut(), calques(), moyen(), appliquer(modifs),
 * annuler(), panoramique(dx, dy), zoom(facteur, point), sur_activation(actif), quantite(), nom(id), signaler(texte),
 * sur_depot(id), choisir_moyen(de, vers), reseau_auto()}. Un calque masqué ne s'édite pas.
 */
export function creer_editeur(env) {
  // mode « edition » : on prépare le scénario à t = 0 ; mode « ordres » : en pause au cours du raid, on envoie des avions.
  const etat = {actif: false, mode: "edition", outil: "selection", selection: [], groupes: {}, geste: null, brouillon: [], curseur: null, liaison: null, depot: null};
  const elements = () => elements_editables(env.monde(), env.brut(), etat.mode).filter((e) => element_visible(env.calques(), e));
  const vers_ecran = (geo) => ecran(env.camera(), geo);
  const local = (e) => {
    const cadre = env.vue.getBoundingClientRect();
    return {x: e.clientX - cadre.left, y: e.clientY - cadre.top};
  };

  function choisir_outil(outil) {
    etat.outil = outil;
    etat.liaison = null;
    if (outil !== "depot" && etat.depot) {
      etat.depot = null;
      env.sur_depot(null);
    }
    env.vue.dataset.outil = outil;
    env.barre.querySelectorAll("[data-outil]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.outil === outil)));
  }

  function activer(actif) {
    const mode = env.monde().t > 0 ? "ordres" : "edition";
    Object.assign(etat, {actif, mode, selection: [], geste: null, brouillon: []});
    env.vue.classList.toggle("edition", actif);
    env.vue.dataset.mode = mode;
    env.barre.hidden = !actif;
    env.barre.querySelector("[data-champ='instant_ordres']").textContent = format_duree(env.monde().t);
    choisir_outil("selection");
    env.sur_activation(actif, mode);
  }

  /** Armer le dépôt de l'unité `id` du catalogue (palette) : chaque clic sur la carte en dépose une, jusqu'à Échap. */
  function armer_depot(id) {
    if (!etat.actif) activer(true);
    if (etat.mode !== "edition") return;
    choisir_outil("depot");
    etat.depot = id;
    env.sur_depot(id);
  }

  /** Déposer l'unité `id` au point écran `p` ; sur une unité déjà placée si le point en touche une (moyens, armements). */
  function deposer(id, p) {
    const sous = element_sous(elements(), vers_ecran, p, 14);
    const modifications = modifications_depot(env.monde(), env.brut(), id, geo_depuis_ecran(env.camera(), p), {quantite: env.quantite(), sous});
    if (!Object.keys(modifications).length) return env.signaler(`${env.nom(id)} : à déposer sur une unité déjà placée (et pas deux fois le même moyen).`);
    env.signaler("");
    env.appliquer(modifications);
  }

  /** Outil liaison : un clic sur un premier nœud (radar, conduite, avion), un clic sur le second, et la liaison existe. */
  function relier(p) {
    const touche = element_sous(elements(), vers_ecran, p, 14);
    const noeud = touche && noeud_element(env.monde(), touche);
    if (!noeud) return void (etat.liaison = null);
    if (!etat.liaison) return void (etat.liaison = {noeud, geo: touche.geo});
    // Le moyen est celui que les deux unités partagent (MODELE § 21.4) ; le choix de la barre l'emporte s'il est commun.
    const moyen = env.choisir_moyen(etat.liaison.noeud, noeud);
    if (moyen) env.appliquer(modifications_ajout_liaison(env.monde(), env.brut(), etat.liaison.noeud, noeud, moyen));
    else env.signaler("Ces deux unités ne partagent aucun moyen de communication : équipez-les depuis la palette (Communications).");
    etat.liaison = null;
  }

  function fermer_zone() {
    if (etat.brouillon.length >= 3) env.appliquer(modifications_ajout_zone(env.brut(), etat.brouillon));
    etat.brouillon = [];
  }

  function commencer(e) {
    const p = local(e);
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      etat.geste = {type: "panoramique", dernier: p};
      return;
    }
    if (e.button !== 0) return;
    const geo = geo_depuis_ecran(env.camera(), p);
    if (etat.outil === "depot" && etat.depot) return deposer(etat.depot, p);
    if (etat.outil === "cible") return env.appliquer(modifications_ajout_cible(env.monde(), geo));
    if (etat.outil === "radar") return env.appliquer(modifications_ajout_radar(env.monde(), geo));
    if (etat.outil === "centre") return env.appliquer(modifications_ajout_centre(env.brut(), geo));
    if (etat.outil === "liaison") return relier(p);
    if (etat.outil === "plan") return env.appliquer(modifications_ajout_passage(env.brut(), geo));
    if (etat.outil === "zone") {
      // Double-clic (ou Entrée) : la zone se ferme ; le second clic du double-clic n'ajoute pas de sommet.
      if (e.detail >= 2) return fermer_zone();
      etat.brouillon.push(geo);
      return;
    }
    const touche = element_sous(elements(), vers_ecran, p);
    if (touche) {
      if (!etat.selection.includes(touche.cle)) etat.selection = e.shiftKey ? [...etat.selection, touche.cle] : [touche.cle];
      // En mode ordres, on ne déplace pas un avion en vol : on le sélectionne, puis on l'envoie au clic droit.
      if (etat.mode === "edition") etat.geste = {type: "glisser", depart: p, de: touche.geo, vers: touche.geo, deplace: false};
    } else {
      if (!e.shiftKey) etat.selection = [];
      etat.geste = {type: "rectangle", rectangle: {x0: p.x, y0: p.y, x1: p.x, y1: p.y}, ajout: e.shiftKey};
    }
  }

  function suivre(e) {
    etat.curseur = local(e);
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

  /** Envoyer la sélection au point visé : en édition, son barycentre y vient (formation conservée) ; en ordres, les avions y vont. */
  function envoyer(e) {
    const choisis = elements().filter((element) => etat.selection.includes(element.cle));
    if (!choisis.length) return;
    const vers = geo_depuis_ecran(env.camera(), local(e));
    if (etat.mode === "ordres") return env.appliquer(modifications_ordre(env.brut(), env.monde(), etat.selection, vers));
    env.appliquer(modifications_deplacement(env.monde(), env.brut(), etat.selection, barycentre(choisis.map((c) => c.geo)), vers));
  }

  function clavier(e) {
    if (!etat.actif || e.target.closest("input, select, textarea")) return;
    const commande = e.ctrlKey || e.metaKey;
    const chiffre = /^Digit([1-9])$/.exec(e.code)?.[1];
    if (e.key === "Escape" && etat.liaison) etat.liaison = null;
    else if (e.key === "Escape" && etat.brouillon.length) etat.brouillon = [];
    else if (e.key === "Enter" && etat.outil === "zone") fermer_zone();
    else if (e.key === "Escape") etat.outil === "selection" ? (etat.selection = []) : choisir_outil("selection");
    else if ((e.key === "Delete" || e.key === "Backspace") && etat.mode === "ordres") {
      // En cours de raid, on ne supprime rien : on met hors service, à cet instant.
      env.appliquer(modifications_panne(env.brut(), env.monde(), etat.selection));
      etat.selection = [];
    } else if (e.key === "Delete" || e.key === "Backspace") {
      env.appliquer(modifications_suppression(env.monde(), env.brut(), etat.selection));
      etat.selection = [];
    } else if (commande && e.key.toLowerCase() === "z") env.annuler();
    else if (chiffre && commande) etat.groupes[chiffre] = [...etat.selection];
    else if (chiffre) etat.selection = [...(etat.groupes[chiffre] ?? [])];
    else if (!commande && etat.mode === "edition" && TOUCHES_OUTILS[e.key.toLowerCase()]) choisir_outil(TOUCHES_OUTILS[e.key.toLowerCase()]);
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
  // Glisser-déposer depuis la palette : la vue entière reçoit le dépôt, carte comprise.
  env.vue.addEventListener("dragover", (e) => {
    if (!e.dataTransfer.types.includes("text/egide-unite")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  });
  env.vue.addEventListener("drop", (e) => {
    const id = e.dataTransfer.getData("text/egide-unite");
    if (!id) return;
    e.preventDefault();
    if (!etat.actif) activer(true);
    if (etat.mode === "edition") deposer(id, local(e));
  });
  env.barre.addEventListener("click", (e) => {
    const bouton = e.target.closest("button");
    if (bouton?.dataset.outil) choisir_outil(bouton.dataset.outil);
    if (bouton?.dataset.action === "annuler_edition") env.annuler();
    if (bouton?.dataset.action === "terminer_edition") activer(false);
    if (bouton?.dataset.action === "reseau_complet") env.appliquer(modifications_reseau_complet());
    if (bouton?.dataset.action === "reseau_auto") env.reseau_auto();
    if (bouton?.dataset.action === "mettre_hors_service") {
      env.appliquer(modifications_panne(env.brut(), env.monde(), etat.selection));
      etat.selection = [];
    }
  });

  /** Dessiner zones, plan de vol et ordres (toujours) puis, en édition, la sélection, le glisser, le rectangle, le brouillon. */
  function dessiner(ctx, camera, monde) {
    const calques = env.calques();
    if (calques.zones) dessiner_zones(ctx, camera, monde);
    if (calques.plan) dessiner_plan(ctx, camera, monde);
    if (calques.missions) dessiner_ordres(ctx, camera, monde);
    if (!etat.actif) return;
    dessiner_brouillon(ctx, camera);
    if (etat.depot && etat.curseur) {
      ctx.font = "12px system-ui, sans-serif";
      ctx.fillStyle = COULEURS.selection;
      ctx.fillText(`+ ${env.nom(etat.depot)}`, etat.curseur.x + 12, etat.curseur.y - 10);
    }
    if (etat.liaison && etat.curseur) {
      const p = ecran(camera, etat.liaison.geo);
      ctx.strokeStyle = COULEURS.selection;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(etat.curseur.x, etat.curseur.y);
      ctx.stroke();
      ctx.setLineDash([]);
    }
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

  function dessiner_zones(ctx, camera, monde) {
    ctx.font = "12px system-ui, sans-serif";
    monde.zones.forEach((zone, i) => {
      const protegee = zone.type === "protegee";
      ctx.beginPath();
      zone.points.forEach((point, j) => {
        const p = ecran(camera, point);
        if (j === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.closePath();
      ctx.fillStyle = protegee ? "rgba(227, 234, 241, 0.07)" : "rgba(227, 234, 241, 0.03)";
      ctx.fill();
      ctx.setLineDash(protegee ? [10, 5] : [2, 4]);
      ctx.strokeStyle = COULEURS.texte;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.setLineDash([]);
      const centre = ecran(camera, zone.centre);
      ctx.fillStyle = COULEURS.texte;
      ctx.textAlign = "center";
      ctx.fillText(zone.nom, centre.x, centre.y - 4);
      if (protegee) {
        ctx.fillStyle = monde.incursions[i].size ? COULEURS.hostile : COULEURS.texte_secondaire;
        ctx.fillText(`${monde.incursions[i].size} incursions`, centre.x, centre.y + 12);
      }
      ctx.textAlign = "start";
    });
  }

  function dessiner_ordres(ctx, camera, monde) {
    ctx.strokeStyle = COULEURS.selection;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 3]);
    for (const avion of monde.avions) {
      if (!avion.ordre) continue;
      const [a, b] = [ecran(camera, avion.geo), ecran(camera, avion.point)];
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.moveTo(b.x - 5, b.y - 5);
      ctx.lineTo(b.x + 5, b.y + 5);
      ctx.moveTo(b.x + 5, b.y - 5);
      ctx.lineTo(b.x - 5, b.y + 5);
      ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  function dessiner_brouillon(ctx, camera) {
    if (!etat.brouillon.length) return;
    const points = etat.brouillon.map((geo) => ecran(camera, geo));
    if (etat.curseur) points.push(etat.curseur);
    ctx.strokeStyle = COULEURS.selection;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.stroke();
    ctx.setLineDash([]);
    for (const p of points.slice(0, etat.brouillon.length)) ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
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

  return {activer, dessiner, armer_depot, est_actif: () => etat.actif, mode: () => etat.mode, selection: () => etat.selection};
}
