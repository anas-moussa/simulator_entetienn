// gestes_calculs.js : calculs (sans caméra) pour reconnaître les gestes des mains et la posture.
// Ces fonctions reçoivent des "points" (x, y entre 0 et 1) fournis par MediaPipe.

// Seuils (à ajuster après tes essais)
const SEUILS_GESTES = {
    doigtEtendu: 1.15,      // un doigt est étendu si son bout est 15 % plus loin du poignet que son articulation
    pouceEtendu: 1.3,
    mainProcheCamera: 0.8,  // si la main paraît aussi grande que 80 % du visage, elle est devant la caméra, pas sur le visage
    mouvementModere: 0.5,   // vitesse des mains, en "hauteurs de visage par seconde"
    mouvementAgite: 2.5,
    epaulesInclinees: 8,    // degrés d'écart avec ta position de départ
    avachi: 0.8,            // hauteur de la tête inférieure à 80 % de celle du départ
    tropPres: 1.25,         // épaules 25 % plus larges que au départ (tu te penches vers l'écran)
    tropLoin: 0.75          // épaules 25 % plus étroites (tu te recules)
  };
  
  // Distance en pixels entre deux points normalisés (W = largeur, H = hauteur de l'image)
  function distPx(a, b, W, H) {
    const dx = (a.x - b.x) * W;
    const dy = (a.y - b.y) * H;
    return Math.sqrt(dx * dx + dy * dy);
  }
  
  // ---------- LES DOIGTS ----------
  
  // Quels doigts sont étendus ? "main" = les 21 points d'une main MediaPipe
  // 0 = poignet ; 4, 8, 12, 16, 20 = bouts des doigts ; 6, 10, 14, 18 = articulations du milieu
  function doigtsEtendus(main, W, H) {
    const poignet = main[0];
    const etendu = function (bout, milieu) {
      return distPx(main[bout], poignet, W, H) > distPx(main[milieu], poignet, W, H) * SEUILS_GESTES.doigtEtendu;
    };
    return {
      pouce: distPx(main[4], main[17], W, H) > distPx(main[2], main[17], W, H) * SEUILS_GESTES.pouceEtendu,
      index: etendu(8, 6),
      majeur: etendu(12, 10),
      annulaire: etendu(16, 14),
      auriculaire: etendu(20, 18)
    };
  }
  
  // Le geste de la main : "ouverte", "poing", "pouce", "pointe", "honneur" ou "autre"
  function classerMain(main, W, H) {
    const d = doigtsEtendus(main, W, H);
    const nb = (d.index ? 1 : 0) + (d.majeur ? 1 : 0) + (d.annulaire ? 1 : 0) + (d.auriculaire ? 1 : 0);
    if (nb === 4) return "ouverte";
    if (nb === 0) return d.pouce ? "pouce" : "poing";
    if (d.index && nb === 1) return "pointe";
    if (d.majeur && nb === 1) return "honneur";
    return "autre";
  }
  
  // ---------- LA MAIN ET LE VISAGE ----------
  
  // Rectangle du visage (coordonnées normalisées), un peu agrandi
  // 234 et 454 = bords du visage ; 10 = haut du front ; 152 = menton
  function boiteVisage(pts) {
    const largeur = pts[454].x - pts[234].x;
    const hauteur = pts[152].y - pts[10].y;
    return {
      x0: pts[234].x - largeur * 0.1,
      x1: pts[454].x + largeur * 0.1,
      y0: pts[10].y - hauteur * 0.1,
      y1: pts[152].y + hauteur * 0.1,
      hauteur: hauteur
    };
  }
  
  // La main touche-t-elle le visage ? Renvoie "bouche", "visage" ou null
  function mainSurVisage(main, ptsVisage, W, H) {
    const b = boiteVisage(ptsVisage);
    const hauteurPx = b.hauteur * H;
    if (hauteurPx <= 0) return null;
  
    // Une main qui paraît énorme est devant la caméra, loin du visage : elle ne le touche pas
    const tailleMain = distPx(main[0], main[9], W, H);
    if (tailleMain / hauteurPx > SEUILS_GESTES.mainProcheCamera) return null;
  
    // Combien de points de la main sont dans le rectangle du visage ?
    const points = [0, 4, 8, 12, 16, 20, 9];   // poignet, bouts des doigts, milieu de la paume
    let dedans = 0;
    for (const i of points) {
      const p = main[i];
      if (p.x >= b.x0 && p.x <= b.x1 && p.y >= b.y0 && p.y <= b.y1) dedans++;
    }
    if (dedans < 2) return null;
  
    // Un bout de doigt près de la bouche ? (13 et 14 = milieu des lèvres)
    const bouche = { x: (ptsVisage[13].x + ptsVisage[14].x) / 2, y: (ptsVisage[13].y + ptsVisage[14].y) / 2 };
    for (const i of [4, 8, 12, 16, 20]) {
      if (distPx(main[i], bouche, W, H) < hauteurPx * 0.3) return "bouche";
    }
    return "visage";
  }
  
  // ---------- LES BRAS ET LA POSTURE (points de la pose : 33 points) ----------
  // 0 = nez ; 11 et 12 = épaules ; 15 et 16 = poignets
  
  function estVisible(p, seuil) {
    return p !== undefined && p !== null && (p.visibility === undefined || p.visibility > seuil);
  }
  
  // Bras croisés ? Renvoie true, false, ou null si on ne voit pas assez
  function brasCroises(pose, W, H) {
    if (!estVisible(pose[11], 0.4) || !estVisible(pose[12], 0.4) ||
        !estVisible(pose[15], 0.4) || !estVisible(pose[16], 0.4)) return null;
  
    const largeurPx = Math.abs(pose[11].x - pose[12].x) * W;
    if (largeurPx < 10) return null;
  
    const milieu = (pose[11].x + pose[12].x) / 2;
    const yEpaules = (pose[11].y + pose[12].y) / 2;
  
    // Un poignet est "croisé" s'il est de l'autre côté du milieu du corps, à hauteur de poitrine
    const croise = function (epaule, poignet) {
      const dy = (poignet.y - yEpaules) * H;
      const dansPoitrine = dy > -0.3 * largeurPx && dy < 1.8 * largeurPx;
      const autreCote = (epaule.x - milieu) * (poignet.x - milieu) < 0 &&
                        Math.abs(poignet.x - milieu) * W > 0.1 * largeurPx;
      return dansPoitrine && autreCote;
    };
    return croise(pose[11], pose[15]) && croise(pose[12], pose[16]);
  }
  
  // Mesures de posture (épaules et tête). Renvoie null si on ne voit pas les épaules
  function mesurerPosture(pose, W, H) {
    const g = pose[11];
    const d = pose[12];
    const nez = pose[0];
    if (!estVisible(g, 0.5) || !estVisible(d, 0.5) || !estVisible(nez, 0.5)) return null;
  
    const largeur = distPx(g, d, W, H);
    if (largeur < 10) return null;
  
    const yMilieu = (g.y + d.y) / 2;
    // Inclinaison de la ligne des épaules en degrés (0 = épaules bien droites)
    let angle = Math.atan2((g.y - d.y) * H, (g.x - d.x) * W) * 180 / Math.PI;
    if (angle > 90) angle -= 180;
    if (angle < -90) angle += 180;
  
    return {
      largeur: largeur,                                  // largeur des épaules en pixels
      hauteurTete: ((yMilieu - nez.y) * H) / largeur,    // distance nez - épaules, relative à la largeur
      inclinaison: angle
    };
  }
  
  // Compare la posture actuelle à la posture de départ (base)
  function evaluerPosture(m, base) {
    if (m === null || base === null || m === undefined || base === undefined) return null;
    return {
      avachi: m.hauteurTete < base.hauteurTete * SEUILS_GESTES.avachi,
      tropPres: m.largeur > base.largeur * SEUILS_GESTES.tropPres,
      tropLoin: m.largeur < base.largeur * SEUILS_GESTES.tropLoin,
      epaulesInclinees: Math.abs(m.inclinaison - base.inclinaison) > SEUILS_GESTES.epaulesInclinees
    };
  }