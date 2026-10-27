import { describe, expect, it, vi } from 'vitest';
import { ErreurMicro, type SessionMicro } from '../../src/audio/micro';
import { DUREE_CALIBRAGE_MS, MARGE_CALIBRAGE_DB } from '../../src/audio/niveau';
import { Ecoute, type VerrouEcran } from '../../src/ecoute.svelte';
import { etat } from './detection';

/** Session de micro factice : silence numérique, aucun appareil. */
function sessionFactice(reglagesPiste: MediaTrackSettings = {}) {
  const arreter = vi.fn(async () => {});
  const session = {
    contexte: { sampleRate: 48000 } as AudioContext,
    analyseur: {} as AnalyserNode,
    flux: {} as MediaStream,
    reglagesPiste,
    lire: (tampon: Float32Array) => tampon.fill(0),
    arreter,
  } satisfies SessionMicro;
  return { session, arreter };
}

function ecoute(
  session: SessionMicro | Promise<SessionMicro> = sessionFactice().session,
  verrou: Promise<VerrouEcran | null> = Promise.resolve(null),
) {
  const surSeuil = vi.fn();
  const rappels: (() => void)[] = [];
  const garderEcranAllume = vi.fn(() => verrou);
  const e = new Ecoute({ a4: 440, seuilSilenceDb: -45 }, surSeuil, {
    demarrerMicro: () => Promise.resolve(session),
    planifier: (rappel) => rappels.push(rappel),
    annuler: () => {},
    maintenant: () => 0,
    garderEcranAllume,
  });
  return { e, surSeuil, rappels, garderEcranAllume };
}

/** Verrou d'écran factice, comme un WakeLockSentinel. */
function verrouFactice() {
  return { release: vi.fn(async () => {}) };
}

describe('Ecoute', () => {
  it('démarre le micro puis mesure le bruit ambiant pendant 2 s avant de transmettre la détection', async () => {
    const { e, surSeuil } = ecoute();
    const recus: number[] = [];
    e.ecouter((d) => recus.push(d.tMs));
    await e.demarrer();
    expect(e.statut).toBe('calibrage');
    for (let t = 0; t < DUREE_CALIBRAGE_MS; t += 100) e.traiterEtat(etat(t, { niveauDbfs: -60 }));
    expect(recus).toEqual([]);
    e.traiterEtat(etat(DUREE_CALIBRAGE_MS, { niveauDbfs: -60 }));
    expect(e.statut).toBe('actif');
    expect(e.seuilDbfs).toBeCloseTo(-60 + MARGE_CALIBRAGE_DB, 1);
    expect(surSeuil).toHaveBeenCalledWith(e.seuilDbfs);
    e.traiterEtat(etat(DUREE_CALIBRAGE_MS + 20));
    expect(recus).toEqual([DUREE_CALIBRAGE_MS + 20]);
  });

  it('analyse le son du micro à chaque image', async () => {
    const { e, rappels } = ecoute();
    await e.demarrer();
    rappels.at(-1)!();
    expect(e.detection).toMatchObject({ silence: true, niveauDbfs: -120 });
    expect(rappels).toHaveLength(2);
  });

  it('affiche le message d’erreur du micro et reste arrêtée', async () => {
    const { e } = ecoute(Promise.reject(new ErreurMicro('Accès au micro refusé.')));
    await e.demarrer();
    expect(e.statut).toBe('arrete');
    expect(e.erreur).toBe('Accès au micro refusé.');
  });

  it('signale les traitements du navigateur restés actifs', async () => {
    const { e } = ecoute(
      sessionFactice({ echoCancellation: false, noiseSuppression: true, autoGainControl: true }).session,
    );
    await e.demarrer();
    expect(e.traitementsActifs).toEqual(['noiseSuppression', 'autoGainControl']);
  });

  it('coupe le micro à l’arrêt, y compris pendant la demande d’autorisation', async () => {
    const { session, arreter } = sessionFactice();
    let accorder: (s: SessionMicro) => void = () => {};
    const { e } = ecoute(new Promise<SessionMicro>((r) => (accorder = r)));
    const demarrage = e.demarrer();
    expect(e.statut).toBe('demarrage');
    await e.arreter();
    accorder(session);
    await demarrage;
    expect(arreter).toHaveBeenCalledOnce();
    expect(e.statut).toBe('arrete');

    const autre = sessionFactice();
    const { e: e2 } = ecoute(autre.session);
    await e2.demarrer();
    await e2.arreter();
    expect(autre.arreter).toHaveBeenCalledOnce();
    expect(e2.statut).toBe('arrete');
    expect(e2.detection).toBeNull();
  });

  it('garde l’écran allumé pendant l’écoute et le libère à l’arrêt', async () => {
    const verrou = verrouFactice();
    const { e, garderEcranAllume } = ecoute(undefined, Promise.resolve(verrou));
    await e.demarrer();
    await new Promise((r) => setTimeout(r, 0));
    expect(garderEcranAllume).toHaveBeenCalledOnce();
    expect(verrou.release).not.toHaveBeenCalled();
    await e.arreter();
    expect(verrou.release).toHaveBeenCalledOnce();
  });

  it('libère l’écran obtenu après l’arrêt, et continue si le navigateur refuse ou l’a déjà libéré', async () => {
    const verrou = verrouFactice();
    let obtenir: (v: VerrouEcran) => void = () => {};
    const { e } = ecoute(undefined, new Promise((r) => (obtenir = r)));
    await e.demarrer();
    await e.arreter();
    obtenir(verrou);
    await new Promise((r) => setTimeout(r, 0));
    expect(verrou.release).toHaveBeenCalledOnce();

    // Refus (économie d'énergie) : le micro démarre quand même.
    const { e: e2 } = ecoute();
    await e2.demarrer();
    expect(e2.statut).toBe('calibrage');

    // Verrou déjà libéré par le navigateur (page en arrière-plan) : l'arrêt ne lève pas d'erreur.
    const deja = { release: vi.fn(() => Promise.reject(new DOMException('déjà libéré'))) };
    const { e: e3 } = ecoute(undefined, Promise.resolve(deja));
    await e3.demarrer();
    await new Promise((r) => setTimeout(r, 0));
    await expect(e3.arreter()).resolves.toBeUndefined();
    expect(e3.statut).toBe('arrete');
  });
});
