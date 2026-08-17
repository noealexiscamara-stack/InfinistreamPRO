import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import type { SourceType } from '@infiny-stream/types';
import { User } from '../users/user.entity';

/**
 * Cloud sync record for a playlist *source* — Premium multi-device sync
 * (product rules #8, #37). This intentionally stores only the reference
 * needed to reconnect a source on another device (URL, or Xtream server +
 * username + encrypted password), never the parsed channel list itself:
 * channels stay local per-device (see mobile apps/mobile/src/utils/db.ts)
 * because they can number in the thousands and are cheap to re-fetch from
 * the original source, which also respects "Infiny Stream is a player,
 * not a redistributor" (product rule about not hosting channel content).
 */
@Entity('playlists')
export class Playlist {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'user_id' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column()
  name!: string;

  @Column({ type: 'varchar' })
  type!: SourceType;

  /**
   * Opaque connection payload: a plain URL for m3u_url/direct_stream, or
   * an encrypted JSON blob ({ serverUrl, username, encryptedPassword })
   * for xtream sources. See common/crypto.util.ts.
   */
  @Column({ type: 'text' })
  source!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
