import type { XtreamImportProgress } from '@/services/xtream/importXtream';

function fmt(n: number): string {
  return n.toLocaleString('fr-FR');
}

const STEP_LABEL: Record<XtreamImportProgress['step'], string> = {
  live: 'chaînes',
  vod: 'films',
  series: 'séries',
};

export function xtreamImportProgressLabel(progress: XtreamImportProgress): string {
  const label = STEP_LABEL[progress.step];

  if (progress.phase === 'connecting') {
    return 'Connexion au serveur…';
  }

  if (progress.phase === 'fetching') {
    if (progress.processedCount != null && progress.processedCount > 0) {
      return `Téléchargement des ${label} (${fmt(progress.processedCount)} reçues)…`;
    }
    return `Téléchargement des ${label}…`;
  }

  if (progress.phase === 'mapping') {
    if (progress.totalCount != null && progress.processedCount != null) {
      return `Traitement des ${label} (${fmt(progress.processedCount)} / ${fmt(progress.totalCount)})…`;
    }
    return `Traitement des ${label}…`;
  }

  if (progress.totalCount != null && progress.processedCount != null) {
    return `Enregistrement (${fmt(progress.processedCount)} / ${fmt(progress.totalCount)})…`;
  }

  return 'Enregistrement…';
}
