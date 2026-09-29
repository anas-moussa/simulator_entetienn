// preparation.js : CV, affaires, tenue (formulaire) et notes correspondantes

let profilCandidat = null;   // rempli au lancement de l'entretien (voir app.js)

// ---------- Points du formulaire de tenue ----------
const PTS_HAUT = { chemise: 3, polo: 2, tshirt: 1, debardeur: 0 };
const PTS_BAS = { classique: 2, jean: 1, sport: 0 };
const PTS_ACCESSOIRES = { sobres: 1, ostentatoires: 0 };

const LIB_HAUT = { chemise: "chemise ou veste", polo: "polo ou pull", tshirt: "t-shirt", debardeur: "débardeur ou maillot" };
const LIB_BAS = { classique: "pantalon classique et chaussures propres", jean: "jean et baskets propres", sport: "short, tongs ou tenue de sport" };
const LIB_ACC = { sobres: "sobres", ostentatoires: "ostentatoires (bijoux, casquette, lunettes de soleil)" };

const CONSEILS_TENUE = {
  vide: "Renseigne ta tenue dans le formulaire avant l'entretien.",
  haut: "Pour un entretien, choisis une chemise ou une veste : un t-shirt, un débardeur ou un maillot fait négligé.",
  bas: "Privilégie un pantalon classique et des chaussures propres et sobres ; évite le short, les tongs et les tenues de sport.",
  accessoires: "Reste sobre : évite les bijoux ostentatoires, la casquette et les lunettes de soleil.",
  fluo: "Évite les couleurs fluo : privilégie des tons neutres (blanc, bleu marine, gris, beige).",
  vive: "Évite les couleurs trop vives : privilégie des tons neutres (blanc, bleu marine, gris, beige).",
  peau: "La zone de ton haut ressemble à de la peau : vérifie que tes épaules et ton torse sont bien couverts.",
  nonMesuree: "Place-toi pour qu'on voie tes épaules et ton haut : la couleur de ton vêtement n'a pas pu être mesurée."
};

const CONSEILS_PREPA = {
  cvVide: "Prépare un CV clair (formation, compétences, projets) et colle son texte avant l'entretien : le recruteur l'a lu, tes réponses doivent s'y appuyer.",
  cvCourt: "Ton CV est très court : ajoute ta formation, tes compétences, tes projets et tes expériences.",
  affaires: "Apporte toujours : ton CV, ton agenda, papier et stylo, et ta liste de questions (comme le demande le cours).",
  coherence: "Appuie-toi sur ton CV : cite au moins deux compétences ou projets qui y figurent."
};

// Compétences reconnues dans le CV et dans les réponses (tu peux en ajouter)
const LISTE_COMPETENCES = ["python", "java", "javascript", "typescript", "sql", "mysql", "html", "css", "php",
  "c++", "c#", "flask", "django", "react", "node", "git", "github", "linux", "docker", "bash", "excel",
  "power bi", "machine learning", "intelligence artificielle", "algorithmique", "reseaux", "cybersecurite",
  "base de donnees", "gestion de projet", "travail en equipe", "anglais", "francais", "arabe"];

// ---------- Lecture du formulaire ----------
function lireProfil() {
  const valeur = function (id) {
    const el = document.getElementById(id);
    return el ? el.value : "";
  };
  const coche = function (id) {
    const el = document.getElementById(id);
    return el ? el.checked : false;
  };
  return {
    cv: valeur("cv-texte"),
    affaires: {
      cvImprime: coche("aff-cv"),
      agenda: coche("aff-agenda"),
      stylo: coche("aff-stylo"),
      questions: coche("aff-questions")
    },
    tenue: {
      haut: valeur("tenue-haut"),
      bas: valeur("tenue-bas"),
      accessoires: valeur("tenue-accessoires")
    },
    couleurHaut: null   // rempli avec la mesure de la caméra
  };
}

// ---------- Couleur du haut (mesurée avec la caméra) ----------

// Donne un nom à une couleur (h = teinte 0-360, s = saturation 0-1, v = luminosité 0-1)
function nomCouleur(h, s, v) {
  if (v < 0.2) return "noir";
  if (s < 0.15) return v > 0.8 ? "blanc" : "gris";
  let base;
  if (h < 15 || h >= 345) base = "rouge";
  else if (h < 40) base = "orange";
  else if (h < 70) base = "jaune";
  else if (h < 160) base = "vert";
  else if (h < 200) base = "cyan";
  else if (h < 260) base = "bleu";
  else if (h < 300) base = "violet";
  else base = "rose";
  return base + (v < 0.45 ? " foncé" : "");
}

// À partir de plusieurs mesures de couleur, décide : neutre, vive, fluo ou proche de la peau
function classerCouleur(echantillons) {
  const mediane = function (cle) {
    const t = echantillons.map(function (e) { return e[cle]; }).sort(function (a, b) { return a - b; });
    return t[Math.floor(t.length / 2)];
  };
  const r = mediane("r");
  const g = mediane("g");
  const b = mediane("b");

  // Conversion RGB -> HSV
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const v = max / 255;
  const s = max === 0 ? 0 : d / max;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }

  let categorie = "neutre";
  if (s >= 0.75 && v >= 0.8) categorie = "fluo";
  else if (s >= 0.6 && v >= 0.55) categorie = "vive";
  else if (h >= 8 && h <= 35 && s >= 0.3 && s <= 0.6 && v >= 0.35 && v <= 0.9) categorie = "peau";

  return { nom: nomCouleur(h, s, v), categorie: categorie, teinte: h, saturation: s, luminosite: v };
}

// Mesure la couleur de la zone sous le menton (le haut) pendant dureeMs
function mesurerCouleurHaut(dureeMs) {
  return new Promise(function (resolve) {
    const video = document.getElementById("video");
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const echantillons = [];

    const minuterie = setInterval(function () {
      const a = window.analyseCamera;
      if (!a || !a.visage || !a.indicateurs.pts || video.videoWidth === 0) return;

      const pts = a.indicateurs.pts;
      const W = canvas.width;
      const H = canvas.height;
      ctx.drawImage(video, 0, 0, W, H);

      // Zone : sous le menton, centrée sur le visage
      const menton = pts[152];
      const bordG = pts[234];
      const bordD = pts[454];
      const largeur = Math.abs(bordD.x - bordG.x) * W;
      const cx = ((bordG.x + bordD.x) / 2) * W;
      const x0 = Math.max(0, Math.floor(cx - largeur * 0.6));
      const y0 = Math.floor(menton.y * H + largeur * 0.5);
      const w = Math.min(W - x0, Math.floor(largeur * 1.2));
      const h = Math.min(H - y0, Math.floor(largeur * 0.8));
      if (w < 8 || h < 8) return;   // le haut du corps n'est pas visible

      const donnees = ctx.getImageData(x0, y0, w, h).data;
      let r = 0, g = 0, b = 0, n = 0;
      for (let i = 0; i < donnees.length; i += 4) {
        r += donnees[i];
        g += donnees[i + 1];
        b += donnees[i + 2];
        n++;
      }
      echantillons.push({ r: r / n, g: g / n, b: b / n });
    }, 150);

    setTimeout(function () {
      clearInterval(minuterie);
      resolve(echantillons.length >= 3 ? classerCouleur(echantillons) : null);
    }, dureeMs);
  });
}

// ---------- Note de la TENUE (sur 10) ----------
function noterTenue(profil) {
  const evenements = [];
  const conseils = [];
  const pointsForts = [];
  const t = profil.tenue;
  let score = 0;

  // Un élément du formulaire : ajoute les points, signale ce qui manque
  // Renvoie true si c'est le meilleur choix
  function element(valeur, tablePts, tableLib, max, texte, conseil) {
    const pts = tablePts[valeur] !== undefined ? tablePts[valeur] : 0;
    score += pts;
    if (!valeur) {
      evenements.push({ categorie: "tenue", points: -max, texte: texte + " : non renseigné" });
      conseils.push(CONSEILS_TENUE.vide);
      return false;
    }
    if (pts < max) {
      evenements.push({ categorie: "tenue", points: pts - max, texte: texte + " : " + tableLib[valeur] });
      conseils.push(conseil);
      return false;
    }
    return true;
  }

  const okHaut = element(t.haut, PTS_HAUT, LIB_HAUT, 3, "Haut", CONSEILS_TENUE.haut);
  const okBas = element(t.bas, PTS_BAS, LIB_BAS, 2, "Bas et chaussures", CONSEILS_TENUE.bas);
  const okAcc = element(t.accessoires, PTS_ACCESSOIRES, LIB_ACC, 1, "Accessoires", CONSEILS_TENUE.accessoires);
  if (okHaut && okBas && okAcc) pointsForts.push("Ta tenue déclarée est adaptée à un entretien.");

  // Couleur du haut (4 points), mesurée par la caméra
  const c = profil.couleurHaut;
  if (c === null || c === undefined) {
    score += 2;
    evenements.push({ categorie: "tenue", points: -2, texte: "Couleur du haut non mesurée (épaules hors champ ?)" });
    conseils.push(CONSEILS_TENUE.nonMesuree);
  } else if (c.categorie === "fluo") {
    evenements.push({ categorie: "tenue", points: -4, texte: "Couleur du haut : " + c.nom + " (fluo)" });
    conseils.push(CONSEILS_TENUE.fluo);
  } else if (c.categorie === "vive") {
    score += 2;
    evenements.push({ categorie: "tenue", points: -2, texte: "Couleur du haut : " + c.nom + " (trop vive)" });
    conseils.push(CONSEILS_TENUE.vive);
  } else if (c.categorie === "peau") {
    score += 2;
    evenements.push({ categorie: "tenue", points: -2, texte: "Zone du haut : teinte proche de la peau (épaules nues ?)" });
    conseils.push(CONSEILS_TENUE.peau);
  } else {
    score += 4;
    pointsForts.push("Couleur du haut sobre (" + c.nom + ").");
  }

  return { nom: "Tenue", score: borner(score, 0, 10), max: 10, evenements: evenements, conseils: conseils, pointsForts: pointsForts };
}

// ---------- Note de la PRÉPARATION (sur 5) ----------
function noterPreparation(profil, reponses) {
  const evenements = [];
  const conseils = [];
  const pointsForts = [];
  let score = 5;
  const cv = normaliser(profil.cv);

  // CV (2 points)
  if (cv.length === 0) {
    score -= 2;
    evenements.push({ categorie: "preparation", points: -2, texte: "Aucun CV fourni" });
    conseils.push(CONSEILS_PREPA.cvVide);
  } else if (cv.length < 200) {
    score -= 1;
    evenements.push({ categorie: "preparation", points: -1, texte: "CV très court" });
    conseils.push(CONSEILS_PREPA.cvCourt);
  } else {
    pointsForts.push("Tu as fourni un CV détaillé.");
  }

  // Affaires à apporter (2 points, 0,5 par élément)
  const a = profil.affaires;
  const manquantes = [];
  if (!a.cvImprime) manquantes.push("CV imprimé");
  if (!a.agenda) manquantes.push("agenda");
  if (!a.stylo) manquantes.push("papier et stylo");
  if (!a.questions) manquantes.push("liste de questions");
  if (manquantes.length > 0) {
    score -= 0.5 * manquantes.length;
    evenements.push({ categorie: "preparation", points: -0.5 * manquantes.length, texte: "Affaires non prévues : " + manquantes.join(", ") });
    conseils.push(CONSEILS_PREPA.affaires);
  } else {
    pointsForts.push("Tu as prévu tout le matériel demandé par le cours.");
  }

  // Cohérence avec le CV (1 point)
  if (cv.length === 0) {
    score -= 1;
  } else {
    const paroles = normaliser(reponses.map(function (r) { return r.reponse; }).join(" "));
    const dansCv = [];
    const horsCv = [];
    for (const comp of LISTE_COMPETENCES) {
      const cite = compterOccurrences(paroles, comp) > 0;
      const auCv = compterOccurrences(cv, comp) > 0;
      if (cite && auCv) dansCv.push(comp);
      else if (cite && !auCv) horsCv.push(comp);
    }
    if (dansCv.length >= 2) {
      pointsForts.push("Tu t'es appuyé sur ton CV (" + dansCv.slice(0, 3).join(", ") + ").");
    } else {
      score -= 1;
      evenements.push({ categorie: "preparation", points: -1, texte: "Peu de compétences de ton CV citées pendant l'entretien (" + dansCv.length + ")" });
      conseils.push(CONSEILS_PREPA.coherence);
    }
    if (horsCv.length > 0) {
      conseils.push("Tu as parlé de " + horsCv.slice(0, 3).join(", ") + " mais cela ne figure pas dans ton CV : ajoute-le ou évite de le citer.");
    }
  }

  return { nom: "Préparation", score: borner(score, 0, 5), max: 5, evenements: evenements, conseils: conseils, pointsForts: pointsForts };
}
// ---------- Envoi du CV (PDF) au serveur ----------
const champCv = document.getElementById("cv-fichier");
const statutCv = document.getElementById("cv-statut");
const zoneCv = document.getElementById("cv-texte");

if (champCv) {
  champCv.addEventListener("change", async function () {
    const fichier = champCv.files[0];
    if (!fichier) return;

    statutCv.textContent = "Lecture du CV en cours…";

    // On prépare l'envoi du fichier au serveur
    const donnees = new FormData();
    donnees.append("cv", fichier);

    try {
      const reponse = await fetch("/api/cv", { method: "POST", body: donnees });
      const resultat = await reponse.json();

      if (!reponse.ok) {
        statutCv.textContent = "⚠ " + resultat.erreur;
        return;
      }
      zoneCv.value = resultat.texte;   // le texte du CV remplit la case
      statutCv.textContent = "✔ CV lu : " + resultat.caracteres + " caractères.";
    } catch (erreur) {
      statutCv.textContent = "⚠ Erreur : " + erreur.message;
    }
  });
}