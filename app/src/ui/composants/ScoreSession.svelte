<script lang="ts">
  import { pourcentage, type Score } from '../../quiz/score';
  import { TEXTES } from '../textes';

  let { score }: { score: Score } = $props();
</script>

<p class="score">
  <span>{TEXTES.quiz.score(score.bonnes, score.questions)}</span>
  <span>{TEXTES.quiz.pourcentage(pourcentage(score))}</span>
  <span>{TEXTES.quiz.serie(score.serie, score.meilleureSerie)}</span>
</p>

<style>
  .score {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 1rem;
    margin-top: 1rem;
    color: var(--discret);
  }
</style>
