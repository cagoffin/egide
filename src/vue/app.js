// Point d'entrée de l'interface : charge le scénario, branche réglages, scope, lecture, tableau et balayage.
import {CatalogueInvalide, charger_unites} from "../moteur/catalogue.js";
import {en_v2, ids_unites, modifier_scenario, resoudre_scenario, ScenarioInvalide} from "../moteur/scenario.js";
import {brancher_balayage, montrer} from "./balayage.js";
import {creer_camera, deplacer, zoomer} from "./camera.js";
import {aide_chemin, valeur_effective} from "./chemins.js";
import {publier_couleurs} from "./couleurs.js";
import {absorber, creer_effets, sauter} from "./effets.js";
import {format_duree} from "./format.js";
import {decrire} from "./infobulles.js";
import {MULTIPLICATEURS, aller_a, avancer_temps_reel, creer_lecteur} from "./lecteur.js";
import {enregistrer_prereglage, exporter_scenario, lire_prereglages} from "./prereglages.js";
import {construire_reglages} from "./reglages.js";
import {dessiner_scope, trouver_sous_curseur} from "./scope.js";
import {mettre_a_jour_tableau} from "./tableau.js";
import {creer_traces, echantillonner} from "./traces.js";

const $ = (selecteur) => document.querySelector(selecteur);
const mouvementReduit = matchMedia("(prefers-reduced-motion: reduce)");
// Un tour de faisceau toutes les 4 s simulées : le balayage visible suit le rythme des plots.
const VITESSE_BALAYAGE = (2 * Math.PI) / 4;

const etat = {base: null, modifications: {}, fichiers: {}, lecteur: null, traces: creer_traces(), effets: creer_effets(),
  camera: null, survol: null, angle: 0, dernierTableau: 0, afficher_reglages: null};

const brut_courant = () => modifier_scenario(etat.base, etat.modifications);

async function lire_json(chemin) {
  const reponse = await fetch(chemin);
  if (!reponse.ok) throw new Error(`${reponse.status} sur ${chemin}`);
  return reponse.json();
}

/** Charger les unités du catalogue que cite `brut` et qui ne sont pas encore en mémoire. */
async function completer_catalogue(brut) {
  const manquantes = ids_unites(brut).filter((id) => !(id in etat.fichiers));
  if (manquantes.length) Object.assign(etat.fichiers, await charger_unites(manquantes, lire_json));
}

const contexte_reglages = () => ({
  valeur: (chemin) => valeur_effective(brut_courant(), etat.fichiers, chemin),
  aide: (chemin) => aide_chemin(brut_courant(), etat.fichiers, chemin),
});

async function charger() {
  const enLecture = etat.lecteur?.enLecture ?? false;
  const multiplicateur = etat.lecteur?.multiplicateur ?? 1;
  const brut = brut_courant();
  try {
    await completer_catalogue(brut);
    etat.lecteur = creer_lecteur(resoudre_scenario(brut, etat.fichiers));
  } catch (erreur) {
    if (!(erreur instanceof ScenarioInvalide || erreur instanceof CatalogueInvalide)) throw erreur;
    $("[data-champ='message']").textContent = `Scénario refusé : ${erreur.message}`;
    return;
  }
  $("[data-champ='message']").textContent = "";
  Object.assign(etat.lecteur, {enLecture, multiplicateur});
  etat.traces = creer_traces();
  etat.effets = creer_effets();
  $("[name='temps']").max = Math.ceil(etat.lecteur.duree);
  $("[name='graine']").value = brut.simulation.graine;
  cadrer();
}

let minuterie = null;
function modifier(modification) {
  Object.assign(etat.modifications, modification);
  clearTimeout(minuterie);
  // Un raid se rejoue en entier pour connaître sa durée : on attend que le curseur se pose.
  minuterie = setTimeout(charger, 200);
}

function cadrer() {
  const toile = $("#scope");
  const ratio = devicePixelRatio || 1;
  toile.width = toile.clientWidth * ratio;
  toile.height = toile.clientHeight * ratio;
  const {monde} = etat.lecteur ?? {};
  if (monde) etat.camera = creer_camera(toile.clientWidth, toile.clientHeight, monde.rayonDetection * 1.08, monde.scenario.theatre.origine);
}

function image(maintenant, precedent) {
  const {lecteur} = etat;
  if (lecteur && etat.camera) {
    const fini = avancer_temps_reel(lecteur, (maintenant - precedent) / 1000, (monde) => echantillonner(etat.traces, monde));
    if (lecteur.enLecture) etat.angle = (lecteur.monde.t * VITESSE_BALAYAGE) % (2 * Math.PI);
    absorber(etat.effets, lecteur.monde, maintenant);
    const ctx = $("#scope").getContext("2d");
    ctx.setTransform(devicePixelRatio || 1, 0, 0, devicePixelRatio || 1, 0, 0);
    dessiner_scope(ctx, etat.camera, {monde: lecteur.monde, traces: etat.traces, effets: etat.effets, maintenant,
      angle: etat.angle, balayage: lecteur.enLecture && !mouvementReduit.matches, survol: etat.survol});
    if (fini || maintenant - etat.dernierTableau > 100) rafraichir_commandes(maintenant);
  }
  requestAnimationFrame((suivant) => image(suivant, maintenant));
}

function rafraichir_commandes(maintenant) {
  const {lecteur} = etat;
  etat.dernierTableau = maintenant;
  mettre_a_jour_tableau($("#tableau"), lecteur.monde);
  $("[name='temps']").value = lecteur.monde.t;
  $("[data-champ='horloge']").textContent = `${format_duree(lecteur.monde.t)} sur ${format_duree(lecteur.duree)}`;
  $("[data-action='lire']").textContent = lecteur.enLecture ? "Pause" : lecteur.monde.t >= lecteur.duree ? "Rejouer" : "Lire";
}

function sauter_a(t) {
  if (t < etat.lecteur.monde.t) etat.traces = creer_traces();
  aller_a(etat.lecteur, t, (monde) => echantillonner(etat.traces, monde));
  sauter(etat.effets, etat.lecteur.monde);
}

function basculer_lecture() {
  const {lecteur} = etat;
  if (lecteur.monde.t >= lecteur.duree) sauter_a(0);
  lecteur.enLecture = !lecteur.enLecture;
}

function brancher_transport() {
  $("[data-action='lire']").addEventListener("click", basculer_lecture);
  $("[data-action='debut']").addEventListener("click", () => sauter_a(0));
  $("[name='temps']").addEventListener("input", (e) => sauter_a(Number(e.target.value)));
  const vitesses = $("[data-zone='vitesses']");
  vitesses.innerHTML = MULTIPLICATEURS.map((m) => `<label><input type="radio" name="vitesse" value="${m}" ${m === 1 ? "checked" : ""}>×${String(m).replace(".", ",")}</label>`).join("");
  vitesses.addEventListener("change", (e) => (etat.lecteur.multiplicateur = Number(e.target.value)));
  $("[name='graine']").addEventListener("change", (e) => modifier({"simulation.graine": Number(e.target.value)}));
  $("[data-action='autre_graine']").addEventListener("click", () => modifier({"simulation.graine": Math.floor(Math.random() * 1e6)}));
  document.querySelectorAll("[name='tactique']").forEach((bouton) => bouton.addEventListener("change", () => modifier({"rouge.tactique": bouton.value})));
  addEventListener("keydown", (e) => {
    if (e.target.closest("input, select, textarea")) return;
    if (e.code === "Space") (e.preventDefault(), basculer_lecture());
    if (e.code === "ArrowRight") sauter_a(etat.lecteur.monde.t + 30);
    if (e.code === "ArrowLeft") sauter_a(Math.max(0, etat.lecteur.monde.t - 30));
  });
}

function brancher_scope() {
  const toile = $("#scope");
  const infobulle = $("#infobulle");
  let glisse = null;
  toile.addEventListener("wheel", (e) => {
    e.preventDefault();
    etat.camera = zoomer(etat.camera, e.deltaY < 0 ? 1.15 : 1 / 1.15, {x: e.offsetX, y: e.offsetY});
  }, {passive: false});
  toile.addEventListener("pointerdown", (e) => (glisse = {x: e.clientX, y: e.clientY}, toile.setPointerCapture(e.pointerId)));
  toile.addEventListener("pointerup", () => (glisse = null));
  toile.addEventListener("dblclick", cadrer);
  toile.addEventListener("pointermove", (e) => {
    if (glisse) {
      etat.camera = deplacer(etat.camera, e.clientX - glisse.x, e.clientY - glisse.y);
      glisse = {x: e.clientX, y: e.clientY};
      return;
    }
    etat.survol = trouver_sous_curseur(etat.camera, etat.lecteur.monde, {x: e.offsetX, y: e.offsetY});
    montrer(infobulle, etat.survol && decrire(etat.survol, etat.lecteur.monde), e.clientX, e.clientY);
  });
  toile.addEventListener("pointerleave", () => (etat.survol = null, montrer(infobulle, null)));
  new ResizeObserver(cadrer).observe(toile);
}

function rafraichir_reglages() {
  etat.afficher_reglages(contexte_reglages());
  document.querySelector(`[name='tactique'][value='${brut_courant().rouge.tactique}']`).checked = true;
}

function brancher_prereglages() {
  const liste = $("[name='prereglage']");
  const remplir = () => (liste.innerHTML = `<option value="">Réglages enregistrés…</option>${Object.keys(lire_prereglages()).map((nom) => `<option>${nom}</option>`).join("")}`);
  remplir();
  liste.addEventListener("change", () => {
    const choisi = lire_prereglages()[liste.value];
    if (!choisi) return;
    etat.modifications = {...choisi};
    charger().then(rafraichir_reglages);
  });
  $("[data-action='enregistrer']").addEventListener("click", () => {
    const nom = $("[name='nom_prereglage']").value.trim();
    if (!nom) return;
    $("[data-champ='message']").textContent = enregistrer_prereglage(nom, etat.modifications) ? `Réglage « ${nom} » enregistré.` : "Ce navigateur refuse d'enregistrer : exportez le scénario.";
    remplir();
  });
  $("[data-action='exporter']").addEventListener("click", () => exporter_scenario(brut_courant(), "egide-scenario.json"));
  $("[data-action='reinitialiser']").addEventListener("click", () => {
    etat.modifications = {};
    charger().then(rafraichir_reglages);
  });
}

async function demarrer() {
  publier_couleurs(document.documentElement);
  etat.base = en_v2(await lire_json("scenarios/reference.json"));
  etat.afficher_reglages = construire_reglages($("#reglages"), modifier);
  brancher_transport();
  brancher_scope();
  brancher_prereglages();
  brancher_balayage($("#balayage"), () => ({brut: brut_courant(), fichiers: etat.fichiers}), $("#infobulle"));
  await charger();
  rafraichir_reglages();
  requestAnimationFrame((t) => image(t, t));
}

demarrer();
