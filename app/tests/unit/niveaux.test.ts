import { describe, expect, it } from 'vitest';
import { noteDePosition } from '../../src/music/manche';
import { avancementInitial, type AvancementMode, type Niveau } from '../../src/progression/modele';
import {
  CASE_MAX_MODE2,
  NIVEAUX,
  TAUX_PASSAGE,
  avancerNiveau,
  caseMaxDuNiveau,
  etatPassage,
  positionsDuNiveau,
} from '../../src/progression/niveaux';

describe('positionsDuNiveau', () => {
  it('suit le contenu des niveaux de la spec §5.4', () => {
    expect(NIVEAUX.map((n) => positionsDuNiveau(n.niveau).length)).toEqual([6, 24, 36, 30, 48, 48, 78]);
  });

  it('niveau 1 : les six cordes à vide', () => {
    expect(positionsDuNiveau(1).map((p) => noteDePosition(p).libelle)).toEqual(['E2', 'A2', 'D3', 'G3', 'B3', 'E4']);
  });

  it.each([
    [2, 5],
    [4, 7],
    [6, 12],
  ] as const)('niveau %i : notes naturelles des cases 0 à %i', (niveau, caseMax) => {
    const p = positionsDuNiveau(niveau);
    expect(p.every((x) => x.case <= caseMax && !noteDePosition(x).nom.includes('#'))).toBe(true);
    expect(p.some((x) => x.case === caseMax)).toBe(true);
  });

  it('mode 2 : limité à la plage validée par le POC (case 12, E5)', () => {
    expect(CASE_MAX_MODE2).toBe(12);
    for (const { niveau } of NIVEAUX) {
      expect(caseMaxDuNiveau(niveau, 2)).toBeLessThanOrEqual(CASE_MAX_MODE2);
      expect(positionsDuNiveau(niveau, 2).every((p) => p.case <= CASE_MAX_MODE2)).toBe(true);
    }
    expect(Math.max(...positionsDuNiveau(7, 2).map((p) => noteDePosition(p).midi))).toBe(76); // E5
  });
});

/** Joue une suite de réponses au niveau `niveauJoue` ; renvoie l'avancement final et les niveaux débloqués. */
function jouer(depart: AvancementMode, reponses: readonly boolean[], niveauJoue = depart.niveauAtteint) {
  let avancement = depart;
  const debloques: Niveau[] = [];
  for (const juste of reponses) {
    const r = avancerNiveau(avancement, niveauJoue, juste);
    avancement = r.avancement;
    if (r.debloque) debloques.push(r.debloque);
  }
  return { avancement, debloques };
}

const justes = (n: number) => Array<boolean>(n).fill(true);
const fausses = (n: number) => Array<boolean>(n).fill(false);

describe('avancerNiveau', () => {
  it('conditions de la spec §5.4 : 20 réponses aux niveaux 1 et 2, 30 aux niveaux 3 à 6, rien au niveau 7', () => {
    expect(NIVEAUX.map((n) => n.reponsesPourPasser)).toEqual([20, 20, 30, 30, 30, 30, null]);
    expect(TAUX_PASSAGE).toBe(0.8);
  });

  it('débloque le niveau suivant à 80 % sur les 20 dernières réponses, puis repart de zéro', () => {
    expect(jouer(avancementInitial(), justes(19)).debloques).toEqual([]);
    const { avancement, debloques } = jouer(avancementInitial(), [...fausses(4), ...justes(16)]);
    expect(debloques).toEqual([2]);
    expect(avancement).toEqual({ niveauAtteint: 2, dernieresReponses: [] });
  });

  it('pas de passage en dessous de 80 %', () => {
    const { avancement, debloques } = jouer(avancementInitial(), [...fausses(5), ...justes(15)]);
    expect(debloques).toEqual([]);
    expect(avancement.dernieresReponses).toHaveLength(20);
  });

  it('ne regarde que les dernières réponses : une mauvaise série ancienne ne pénalise plus', () => {
    // 10 fausses puis 15 justes : les 20 dernières comptent 5 fausses (75 %), puis une juste de plus : 80 %.
    expect(jouer(avancementInitial(), [...fausses(10), ...justes(15)]).debloques).toEqual([]);
    expect(jouer(avancementInitial(), [...fausses(10), ...justes(16)]).debloques).toEqual([2]);
  });

  it('niveau 3 : 30 réponses ; niveau 7 : jamais de passage', () => {
    expect(jouer(avancementInitial(3), justes(29)).debloques).toEqual([]);
    expect(jouer(avancementInitial(3), justes(30)).debloques).toEqual([4]);
    const fin = jouer(avancementInitial(7), justes(100));
    expect(fin.debloques).toEqual([]);
    expect(fin.avancement).toEqual(avancementInitial(7));
  });

  it('les réponses à un niveau inférieur (entraînement) ne comptent pas', () => {
    const { avancement, debloques } = jouer(avancementInitial(3), justes(40), 2);
    expect(debloques).toEqual([]);
    expect(avancement).toEqual(avancementInitial(3));
  });

  it('etatPassage : réponses comptées, requises et réussites', () => {
    expect(etatPassage({ niveauAtteint: 2, dernieresReponses: [true, false, true] })).toEqual({
      reponses: 3,
      requises: 20,
      reussites: 2,
    });
    expect(etatPassage(avancementInitial(7))).toBeNull();
  });
});
