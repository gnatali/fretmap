// @vitest-environment jsdom
import { render } from '@testing-library/svelte';
import { describe, expect, it } from 'vitest';
import './resize-observer';
import type { Niveau } from '../../src/progression/modele';
import { contenuNiveau, positionsDuNiveau } from '../../src/progression/niveaux';
import { tirerQuestion } from '../../src/quiz/tirage';
import MancheChute from '../../src/ui/composants/MancheChute.svelte';

const question = (niveau: Niveau, corde: number, numeroCase: number) => {
  const candidates = positionsDuNiveau(niveau).filter((p) => p.corde === corde && p.case === numeroCase);
  return tirerQuestion(candidates, contenuNiveau(niveau), () => 0);
};

describe('MancheChute', () => {
  it('dessine les cases du niveau, de la case 0 à la case maximale', () => {
    const { container } = render(MancheChute, { caseMax: 5, notes: [], notation: 'les-deux' });
    expect(container.querySelectorAll('.case')).toHaveLength(6);
    expect(container.querySelectorAll('.corde')).toHaveLength(6);
  });

  it('place chaque note dans la colonne de sa corde, la plus basse étant la note attendue', () => {
    const { container } = render(MancheChute, {
      caseMax: 7,
      notation: 'les-deux',
      notes: [
        { index: 1, question: question(7, 3, 0), progression: 0.5 },
        { index: 2, question: question(7, 6, 1), progression: 0.1 },
      ],
    });
    const notes = [...container.querySelectorAll<HTMLElement>('.note')];
    expect(notes.map((n) => n.dataset.index)).toEqual(['1', '2']);
    expect(notes[0]!.classList.contains('attendue')).toBe(true);
    expect(notes[1]!.classList.contains('attendue')).toBe(false);
    // Corde 3 : 4e colonne (6, 5, 4, 3…), centre à 3,5 / 6. Corde 6 : 1re colonne.
    expect(notes[0]!.style.left).toMatch(/^58\.33/);
    expect(notes[1]!.style.left).toMatch(/^8\.33/);
    expect(notes[0]!.textContent).toContain('Sol');
    expect(notes[0]!.querySelector('.secondaire')!.textContent).toBe('G');
  });

  it('suit la notation et affiche la case avec l’option de mesure', () => {
    const { container } = render(MancheChute, {
      caseMax: 7,
      notation: 'francaise',
      afficherCase: true,
      notes: [{ index: 1, question: question(7, 5, 3), progression: 0 }],
    });
    const etiquette = container.querySelector('.note')!;
    expect(etiquette.querySelector('.nom')!.textContent).toBe('Do');
    expect([...etiquette.querySelectorAll('.secondaire')].map((s) => s.textContent)).toEqual(['c. 3']);
  });

  it('niveau 1 : la note tombe au centre du manche', () => {
    const e = tirerQuestion(positionsDuNiveau(1), contenuNiveau(1), () => 0);
    const { container } = render(MancheChute, {
      caseMax: 0,
      notation: 'les-deux',
      afficherCase: true,
      notes: [{ index: 1, question: e, progression: 0.3 }],
    });
    const note = container.querySelector<HTMLElement>('.note')!;
    expect(note.style.left).toBe('50%');
    expect(note.classList.contains('large')).toBe(true);
    expect(note.textContent).not.toContain('c.');
  });

  it('montre les bonnes cases du rappel et les effets', () => {
    const q = question(7, 3, 0);
    const { container } = render(MancheChute, {
      caseMax: 12,
      notation: 'les-deux',
      notes: [],
      rappel: q.positionsCorrectes,
      effets: [{ id: 1, question: q, progression: 0.4, juste: false }],
    });
    const rappel = [...container.querySelectorAll<HTMLElement>('.rappel')];
    expect(rappel.map((r) => r.dataset.position)).toEqual(['3-0', '3-12']);
    expect(rappel[1]!.style.top).toMatch(/^92\.3/);
    expect(container.querySelector('.effet.faux')!.textContent!.trim()).toBe('✗');
  });
});
