import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import type { DevicePlatform } from '@infiny-stream/types';
import { User } from '../users/user.entity';

export type PairingStatus = 'pending' | 'approved' | 'consumed' | 'denied';

/**
 * One TV-pairing attempt, following the OAuth 2.0 Device Authorization
 * Grant shape (RFC 8628).
 *
 * Two distinct secrets, and the distinction is the whole security model:
 *
 *  - `code` is the SHORT one displayed on the television. It has to be
 *    readable across a room and typeable on a phone, so it is inherently
 *    low-entropy and must be assumed guessable.
 *  - `deviceSecretHash` covers the LONG secret handed only to the TV at
 *    the start of the flow and never displayed anywhere. Polling requires
 *    it, so guessing a short code gets an attacker nothing: they cannot
 *    collect the resulting access token.
 *
 * The secret is stored as a plain SHA-256 digest rather than bcrypt. That
 * is deliberate and safe here because the secret is 256 bits of CSPRNG
 * output — there is no dictionary to attack, and the TV polls every few
 * seconds, so a deliberately slow hash would be a self-inflicted DoS.
 */
@Entity('pairing_codes')
export class PairingCode {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Short, human-readable, shown on the TV screen. Unique among live codes. */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 16 })
  code!: string;

  @Column({ name: 'device_secret_hash', type: 'varchar', length: 64 })
  deviceSecretHash!: string;

  @Column({ type: 'varchar', default: 'pending' })
  status!: PairingStatus;

  /** What the user is asked to authorise — shown on the confirmation screen. */
  @Column({ name: 'device_name', type: 'varchar' })
  deviceName!: string;

  @Column({ type: 'varchar' })
  platform!: DevicePlatform;

  @Index()
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId!: string | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  /** Device row created when the pairing was approved, for auditability. */
  @Column({ name: 'device_id', type: 'uuid', nullable: true })
  deviceId!: string | null;

  /** Failed poll attempts with a bad secret — brute-force guard. */
  @Column({ name: 'failed_attempts', type: 'int', default: 0 })
  failedAttempts!: number;

  @Index()
  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt!: Date | null;

  /** Set once the TV has collected its token. A pairing is strictly single-use. */
  @Column({ name: 'consumed_at', type: 'timestamptz', nullable: true })
  consumedAt!: Date | null;

  @Column({ name: 'created_at', type: 'timestamptz', default: () => 'now()' })
  createdAt!: Date;
}
