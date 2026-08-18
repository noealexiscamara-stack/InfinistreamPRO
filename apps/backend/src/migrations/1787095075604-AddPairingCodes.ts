import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPairingCodes1787095075604 implements MigrationInterface {
    name = 'AddPairingCodes1787095075604'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "pairing_codes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "code" character varying(16) NOT NULL, "device_secret_hash" character varying(64) NOT NULL, "status" character varying NOT NULL DEFAULT 'pending', "device_name" character varying NOT NULL, "platform" character varying NOT NULL, "user_id" uuid, "device_id" uuid, "failed_attempts" integer NOT NULL DEFAULT '0', "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "approved_at" TIMESTAMP WITH TIME ZONE, "consumed_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_08509f00aaa786863d624b68fb1" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_91fed1211749e4a8cca176111d" ON "pairing_codes" ("code") `);
        await queryRunner.query(`CREATE INDEX "IDX_666fdc33dc3f6e7835ecdbd6a2" ON "pairing_codes" ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_b81a373827e71527144f01c9e2" ON "pairing_codes" ("expires_at") `);
        await queryRunner.query(`ALTER TABLE "pairing_codes" ADD CONSTRAINT "FK_666fdc33dc3f6e7835ecdbd6a29" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "pairing_codes" DROP CONSTRAINT "FK_666fdc33dc3f6e7835ecdbd6a29"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b81a373827e71527144f01c9e2"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_666fdc33dc3f6e7835ecdbd6a2"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_91fed1211749e4a8cca176111d"`);
        await queryRunner.query(`DROP TABLE "pairing_codes"`);
    }

}
