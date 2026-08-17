import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { Playlist } from './playlist.entity';
import { encryptSecret, decryptSecret } from '../common/crypto.util';
import type { CreatePlaylistDto } from './dto/create-playlist.dto';

@Injectable()
export class PlaylistsService {
  constructor(
    @InjectRepository(Playlist) private readonly playlistsRepo: Repository<Playlist>,
    private readonly configService: ConfigService
  ) {}

  async list(userId: string) {
    const playlists = await this.playlistsRepo.find({ where: { userId }, order: { createdAt: 'ASC' } });
    return playlists.map((p) => this.toPublicShape(p));
  }

  async create(userId: string, dto: CreatePlaylistDto) {
    const source =
      dto.type === 'xtream'
        ? JSON.stringify({
            serverUrl: dto.serverUrl,
            username: dto.username,
            encryptedPassword: dto.password
              ? encryptSecret(dto.password, this.configService.get<string>('security.encryptionKey')!)
              : undefined,
          })
        : (dto.url ?? '');

    const playlist = this.playlistsRepo.create({ userId, name: dto.name, type: dto.type, source });
    const saved = await this.playlistsRepo.save(playlist);
    return this.toPublicShape(saved);
  }

  async remove(userId: string, id: string) {
    await this.playlistsRepo.delete({ id, userId });
  }

  /** Strips the encrypted password out of any response — the client already has it locally; the server never needs to echo it back. */
  private toPublicShape(playlist: Playlist) {
    if (playlist.type !== 'xtream') {
      return { id: playlist.id, name: playlist.name, type: playlist.type, url: playlist.source, createdAt: playlist.createdAt };
    }
    const parsed = JSON.parse(playlist.source) as { serverUrl?: string; username?: string };
    return {
      id: playlist.id,
      name: playlist.name,
      type: playlist.type,
      serverUrl: parsed.serverUrl,
      username: parsed.username,
      createdAt: playlist.createdAt,
    };
  }
}

/** Exported for completeness/testing — not currently called from a controller since the client re-enters its own Xtream password rather than round-tripping it. */
export function decryptPlaylistPassword(encryptedPassword: string, encryptionKey: string): string {
  return decryptSecret(encryptedPassword, encryptionKey);
}
