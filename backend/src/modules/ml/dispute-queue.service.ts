import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../../config/database';

type DbClient = PrismaClient | Prisma.TransactionClient;

const DEFAULT_BATCH_NUMBER = 0;
const DEFAULT_MIN_INTERVAL_MS = 30_000;
const SYSTEM_SYNC_ACTOR = 'system-sync';

let lastBridgeAt = 0;
let inflightBridge: Promise<BridgeResult> | null = null;

type BridgeOptions = {
    onlyIds?: number[];
    take?: number;
    force?: boolean;
    minIntervalMs?: number;
};

type BridgeResult = {
    synced: number;
    closed: number;
    skipped: boolean;
};

function shouldThrottle(options?: BridgeOptions): boolean {
    return !options?.force && !(options?.onlyIds?.length);
}

function normalizeOnlyIds(options?: BridgeOptions): number[] | undefined {
    if (!options?.onlyIds?.length) return undefined;
    return Array.from(new Set(options.onlyIds.filter((id) => Number.isInteger(id) && id > 0)));
}

function isDisputeCandidate(row: { nbKategoriId: number | null; llmKategoriId: number | null }): boolean {
    return row.nbKategoriId != null && row.llmKategoriId != null && row.nbKategoriId !== row.llmKategoriId;
}

async function runBridge(db: DbClient, options?: BridgeOptions): Promise<BridgeResult> {
    const onlyIds = normalizeOnlyIds(options);
    // Not filtering by kategoriDogrulandi here — both Wave3-conflicted (false) and verified (true) records
    // should have their disputes tracked. Drift protection catches mismatches that resolve naturally.
    const where: Prisma.HaberWhereInput = {
        durum: 'ham',
        ...(onlyIds?.length ? { id: { in: onlyIds } } : {}),
    };

    const allCandidates = await db.haber.findMany({
        where,
        select: {
            id: true,
            nbKategoriId: true,
            llmKategoriId: true,
            mlConfidence: true,
        },
        orderBy: { id: 'asc' },
        ...(options?.take ? { take: options.take } : {}),
    });

    // Dispute kuralı explicit: yalnızca NB/LR ve LLM kategorileri farklıysa queue'ya alınır.
    const candidates = allCandidates.filter(isDisputeCandidate);
    const candidateIds = new Set(candidates.map((row) => row.id));

    const pendingRows = await db.disputeQueue.findMany({
        where: {
            durum: 'bekliyor',
            ...(onlyIds?.length ? { haberId: { in: onlyIds } } : {}),
        },
        select: { id: true, haberId: true },
    });

    const stalePendingIds = pendingRows
        .filter((row) => !candidateIds.has(row.haberId))
        .map((row) => row.id);

    let closed = 0;
    if (stalePendingIds.length > 0) {
        const closeResult = await db.disputeQueue.updateMany({
            where: { id: { in: stalePendingIds } },
            data: {
                durum: 'atildi',
                adminKararKategoriId: null,
                resolvedAt: new Date(),
                resolvedBy: SYSTEM_SYNC_ACTOR,
            },
        });
        closed = closeResult.count;
    }

    let synced = 0;
    for (const row of candidates) {
        await db.disputeQueue.upsert({
            where: { haberId: row.id },
            create: {
                haberId: row.id,
                nbKategoriId: row.nbKategoriId ?? null,
                llmKategoriId: row.llmKategoriId ?? null,
                nbGuvenSkoru: row.mlConfidence ?? null,
                llmGuvenSkoru: null,
                batchNumber: DEFAULT_BATCH_NUMBER,
                durum: 'bekliyor',
            },
            update: {
                nbKategoriId: row.nbKategoriId ?? null,
                llmKategoriId: row.llmKategoriId ?? null,
                nbGuvenSkoru: row.mlConfidence ?? null,
                durum: 'bekliyor',
                adminKararKategoriId: null,
                resolvedAt: null,
                resolvedBy: null,
            },
        });
        synced += 1;
    }

    return { synced, closed, skipped: false };
}

export async function bridgeHamVerifiedToDisputeQueue(
    db: DbClient = prisma,
    options?: BridgeOptions
) {
    if (shouldThrottle(options)) {
        const minIntervalMs = options?.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS;
        const elapsed = Date.now() - lastBridgeAt;

        if (inflightBridge) {
            return inflightBridge;
        }

        if (elapsed < minIntervalMs) {
            return { synced: 0, closed: 0, skipped: true };
        }

        inflightBridge = runBridge(db, options)
            .then((result) => {
                lastBridgeAt = Date.now();
                return result;
            })
            .finally(() => {
                inflightBridge = null;
            });

        return inflightBridge;
    }

    return runBridge(db, options);
}
