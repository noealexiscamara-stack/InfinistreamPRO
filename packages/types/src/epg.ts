export interface EpgProgram {
  id: string;
  channelTvgId: string;
  title: string;
  description?: string;
  startMs: number;
  endMs: number;
}

export interface EpgSource {
  id: string;
  url: string;
  lastRefreshedAt?: string;
}
