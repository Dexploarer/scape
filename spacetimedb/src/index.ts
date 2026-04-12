import { ScheduleAt } from "spacetimedb";
import {
    CaseConversionPolicy,
    type ReducerExport,
    SenderError,
    schema,
    t,
    table,
} from "spacetimedb/server";

function requiredText(label: string, value: string): string {
    const trimmed = value.trim();
    if (!trimmed) {
        throw new SenderError(`${label} is required`);
    }
    return trimmed;
}

function optionalText(value: string | undefined): string | undefined {
    const trimmed = value?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function upsertRow<Row>(
    existing: Row | null | undefined,
    deleteExisting: (row: Row) => void,
    insertRow: (row: Row) => Row,
    nextRow: Row,
): Row {
    if (existing != null) {
        deleteExisting(existing);
    }
    return insertRow(nextRow);
}

const worldColumns = {
    world_id: t.string().primaryKey(),
    name: t.string(),
    gamemode_id: t.string(),
    status: t.string(),
    release_id: t.string().optional(),
    owner_principal_id: t.string().optional(),
    metadata_json: t.string().optional(),
    created_at: t.u64(),
    updated_at: t.u64(),
};

const principalColumns = {
    principal_id: t.string().primaryKey(),
    principal_kind: t.string(),
    canonical_name: t.string(),
    created_at: t.u64(),
    updated_at: t.u64(),
};

const loginAccountColumns = {
    username: t.string().primaryKey(),
    principal_id: t.string(),
    auth_mode: t.string(),
    password_hash: t.string().optional(),
    password_salt: t.string().optional(),
    password_algorithm: t.string().optional(),
    external_subject: t.string().optional(),
    banned: t.bool(),
    ban_reason: t.string().optional(),
    created_at: t.u64(),
    last_login_at: t.u64().optional(),
};

const worldCharacterColumns = {
    world_character_id: t.string().primaryKey(),
    world_id: t.string(),
    principal_id: t.string(),
    display_name: t.string(),
    branch_kind: t.string().optional(),
    created_at: t.u64(),
    last_seen_at: t.u64().optional(),
};

const playerSnapshotColumns = {
    world_character_id: t.string().primaryKey(),
    world_id: t.string(),
    principal_id: t.string(),
    snapshot_version: t.u32(),
    persistent_vars_json: t.string(),
    updated_at: t.u64(),
};

const agentProfileColumns = {
    principal_id: t.string().primaryKey(),
    agent_id: t.string().unique(),
    display_name: t.string(),
    persona_json: t.string().optional(),
    controller_defaults_json: t.string().optional(),
    created_at: t.u64(),
    updated_at: t.u64(),
};

const agentMemoryColumns = {
    memory_id: t.string().primaryKey(),
    principal_id: t.string(),
    memory_scope: t.string(),
    world_id: t.string().optional(),
    memory_key: t.string(),
    value_json: t.string(),
    updated_at: t.u64(),
};

const trajectoryEpisodeColumns = {
    episode_id: t.string().primaryKey(),
    world_id: t.string(),
    principal_id: t.string(),
    world_character_id: t.string(),
    source: t.string(),
    model: t.string().optional(),
    build_sha: t.string().optional(),
    started_at: t.u64(),
    ended_at: t.u64().optional(),
};

const trajectoryStepColumns = {
    step_id: t.string().primaryKey(),
    episode_id: t.string(),
    step_index: t.u32(),
    tick: t.u64().optional(),
    observation_toon: t.string().optional(),
    action_kind: t.string().optional(),
    action_toon: t.string().optional(),
    outcome_toon: t.string().optional(),
    latency_ms: t.u32().optional(),
    reward_tags_json: t.string().optional(),
    created_at: t.u64(),
};

const liveEventColumns = {
    event_id: t.string(),
    world_id: t.string().optional(),
    principal_id: t.string().optional(),
    world_character_id: t.string().optional(),
    event_kind: t.string(),
    payload_json: t.string().optional(),
    created_at: t.u64(),
};

const scheduledJobColumns = {
    job_id: t.string().primaryKey(),
    schedule_at: t.scheduleAt(),
    world_id: t.string().optional(),
    job_kind: t.string(),
    payload_json: t.string(),
    created_at: t.u64(),
};

let drain_scheduled_job_ref!: ReducerExport<any, { job: any }>;

const worldPackageColumns = {
    package_id: t.string().primaryKey(),
    owner_principal_id: t.string(),
    slug: t.string(),
    display_name: t.string(),
    manifest_json: t.string(),
    created_at: t.u64(),
    updated_at: t.u64(),
};

const worldReleaseColumns = {
    release_id: t.string().primaryKey(),
    package_id: t.string(),
    world_id: t.string(),
    image_ref: t.string(),
    revision: t.string(),
    config_json: t.string(),
    created_at: t.u64(),
    deployed_at: t.u64().optional(),
};

const worldPatchColumns = {
    patch_id: t.string().primaryKey(),
    package_id: t.string().optional(),
    world_id: t.string().optional(),
    patch_kind: t.string(),
    payload_json: t.string(),
    created_at: t.u64(),
};

const prefabColumns = {
    prefab_id: t.string().primaryKey(),
    owner_principal_id: t.string(),
    name: t.string(),
    prefab_kind: t.string(),
    payload_json: t.string(),
    created_at: t.u64(),
    updated_at: t.u64(),
};

const world = table(
    {
        name: "world",
        public: true,
        indexes: [
            { accessor: "by_status", algorithm: "btree", columns: ["status"] as const },
            { accessor: "by_owner", algorithm: "btree", columns: ["owner_principal_id"] as const },
        ],
    },
    worldColumns,
);

const principal = table(
    {
        name: "principal",
        indexes: [
            { accessor: "by_kind", algorithm: "btree", columns: ["principal_kind"] as const },
            { accessor: "by_name", algorithm: "btree", columns: ["canonical_name"] as const },
        ],
    },
    principalColumns,
);

const login_account = table(
    {
        name: "login_account",
        indexes: [
            { accessor: "by_principal", algorithm: "btree", columns: ["principal_id"] as const },
            { accessor: "by_auth_mode", algorithm: "btree", columns: ["auth_mode"] as const },
        ],
    },
    loginAccountColumns,
);

const world_character = table(
    {
        name: "world_character",
        indexes: [
            {
                accessor: "by_world_principal",
                algorithm: "btree",
                columns: ["world_id", "principal_id"] as const,
            },
            { accessor: "by_principal", algorithm: "btree", columns: ["principal_id"] as const },
        ],
    },
    worldCharacterColumns,
);

const player_snapshot = table(
    {
        name: "player_snapshot",
        indexes: [
            { accessor: "by_world", algorithm: "btree", columns: ["world_id"] as const },
            {
                accessor: "by_world_principal",
                algorithm: "btree",
                columns: ["world_id", "principal_id"] as const,
            },
        ],
    },
    playerSnapshotColumns,
);

const agent_profile = table(
    {
        name: "agent_profile",
        indexes: [
            { accessor: "by_display_name", algorithm: "btree", columns: ["display_name"] as const },
        ],
    },
    agentProfileColumns,
);

const agent_memory = table(
    {
        name: "agent_memory",
        indexes: [
            {
                accessor: "by_principal_scope",
                algorithm: "btree",
                columns: ["principal_id", "memory_scope"] as const,
            },
            {
                accessor: "by_world_memory",
                algorithm: "btree",
                columns: ["world_id", "memory_key"] as const,
            },
        ],
    },
    agentMemoryColumns,
);

const trajectory_episode = table(
    {
        name: "trajectory_episode",
        indexes: [
            { accessor: "by_world", algorithm: "btree", columns: ["world_id"] as const },
            { accessor: "by_principal", algorithm: "btree", columns: ["principal_id"] as const },
        ],
    },
    trajectoryEpisodeColumns,
);

const trajectory_step = table(
    {
        name: "trajectory_step",
        indexes: [
            {
                accessor: "by_episode_step",
                algorithm: "btree",
                columns: ["episode_id", "step_index"] as const,
            },
        ],
    },
    trajectoryStepColumns,
);

const live_event = table(
    {
        name: "live_event",
        public: true,
        event: true,
        indexes: [
            { accessor: "by_kind", algorithm: "btree", columns: ["event_kind"] as const },
            { accessor: "by_world", algorithm: "btree", columns: ["world_id"] as const },
        ],
    },
    liveEventColumns,
);

const scheduled_job = table(
    {
        name: "scheduled_job",
        // The TypeScript module library models scheduled reducers as a row-builder map.
        // Our reducer takes exactly one row argument (`job`), so cast at the table boundary
        // rather than degrading type safety throughout the module.
        scheduled: () => drain_scheduled_job_ref as any,
        indexes: [
            { accessor: "by_kind", algorithm: "btree", columns: ["job_kind"] as const },
            { accessor: "by_world", algorithm: "btree", columns: ["world_id"] as const },
        ],
    },
    scheduledJobColumns,
);

const scheduledJobReducerParams = {
    job: scheduled_job.rowType,
};

const world_package = table(
    {
        name: "world_package",
        indexes: [
            { accessor: "by_owner", algorithm: "btree", columns: ["owner_principal_id"] as const },
            { accessor: "by_slug", algorithm: "btree", columns: ["slug"] as const },
        ],
    },
    worldPackageColumns,
);

const world_release = table(
    {
        name: "world_release",
        public: true,
        indexes: [
            { accessor: "by_package", algorithm: "btree", columns: ["package_id"] as const },
            { accessor: "by_world", algorithm: "btree", columns: ["world_id"] as const },
        ],
    },
    worldReleaseColumns,
);

const world_patch = table(
    {
        name: "world_patch",
        indexes: [
            { accessor: "by_package", algorithm: "btree", columns: ["package_id"] as const },
            { accessor: "by_world", algorithm: "btree", columns: ["world_id"] as const },
        ],
    },
    worldPatchColumns,
);

const prefab = table(
    {
        name: "prefab",
        indexes: [
            { accessor: "by_owner", algorithm: "btree", columns: ["owner_principal_id"] as const },
            { accessor: "by_kind", algorithm: "btree", columns: ["prefab_kind"] as const },
        ],
    },
    prefabColumns,
);

const control_plane = schema(
    {
        world,
        principal,
        login_account,
        world_character,
        player_snapshot,
        agent_profile,
        agent_memory,
        trajectory_episode,
        trajectory_step,
        live_event,
        scheduled_job,
        world_package,
        world_release,
        world_patch,
        prefab,
    },
    {
        CASE_CONVERSION_POLICY: CaseConversionPolicy.None,
    },
);

export default control_plane;

export const init = control_plane.init(() => {
    // Intentionally blank: hosted worlds seed themselves through reducers so
    // deploys can stay additive and world-specific.
});

export const upsert_world = control_plane.reducer(worldColumns, (ctx, payload) => {
    const world_id = requiredText("world_id", payload.world_id);
    const nextRow = {
        ...payload,
        world_id,
        name: requiredText("name", payload.name),
        gamemode_id: requiredText("gamemode_id", payload.gamemode_id),
        status: requiredText("status", payload.status),
        release_id: optionalText(payload.release_id),
        owner_principal_id: optionalText(payload.owner_principal_id),
        metadata_json: optionalText(payload.metadata_json),
        updated_at: ctx.timestamp.microsSinceUnixEpoch,
    };
    return upsertRow(
        ctx.db.world.world_id.find(world_id),
        (row) => ctx.db.world.delete(row),
        (row) => ctx.db.world.insert(row),
        nextRow,
    );
});

export const upsert_principal = control_plane.reducer(principalColumns, (ctx, payload) => {
    const principal_id = requiredText("principal_id", payload.principal_id);
    const nextRow = {
        ...payload,
        principal_id,
        principal_kind: requiredText("principal_kind", payload.principal_kind),
        canonical_name: requiredText("canonical_name", payload.canonical_name),
        updated_at: ctx.timestamp.microsSinceUnixEpoch,
    };
    return upsertRow(
        ctx.db.principal.principal_id.find(principal_id),
        (row) => ctx.db.principal.delete(row),
        (row) => ctx.db.principal.insert(row),
        nextRow,
    );
});

export const upsert_login_account = control_plane.reducer(loginAccountColumns, (ctx, payload) => {
    const username = requiredText("username", payload.username).toLowerCase();
    const nextRow = {
        ...payload,
        username,
        principal_id: requiredText("principal_id", payload.principal_id),
        auth_mode: requiredText("auth_mode", payload.auth_mode),
        password_hash: optionalText(payload.password_hash),
        password_salt: optionalText(payload.password_salt),
        password_algorithm: optionalText(payload.password_algorithm),
        external_subject: optionalText(payload.external_subject),
        ban_reason: optionalText(payload.ban_reason),
        last_login_at: payload.last_login_at,
    };
    return upsertRow(
        ctx.db.login_account.username.find(username),
        (row) => ctx.db.login_account.delete(row),
        (row) => ctx.db.login_account.insert(row),
        nextRow,
    );
});

export const touch_login_account = control_plane.reducer(
    {
        username: t.string(),
        last_login_at: t.u64().optional(),
    },
    (ctx, payload) => {
        const username = requiredText("username", payload.username).toLowerCase();
        const existing = ctx.db.login_account.username.find(username);
        if (!existing) {
            throw new SenderError(`login_account ${username} does not exist`);
        }
        return upsertRow(
            existing,
            (row) => ctx.db.login_account.delete(row),
            (row) => ctx.db.login_account.insert(row),
            {
                ...existing,
                last_login_at: payload.last_login_at ?? ctx.timestamp.microsSinceUnixEpoch,
            },
        );
    },
);

export const upsert_world_character = control_plane.reducer(
    worldCharacterColumns,
    (_ctx, payload) => {
        const world_character_id = requiredText("world_character_id", payload.world_character_id);
        const nextRow = {
            ...payload,
            world_character_id,
            world_id: requiredText("world_id", payload.world_id),
            principal_id: requiredText("principal_id", payload.principal_id),
            display_name: requiredText("display_name", payload.display_name),
            branch_kind: optionalText(payload.branch_kind),
        };
        return upsertRow(
            _ctx.db.world_character.world_character_id.find(world_character_id),
            (row) => _ctx.db.world_character.delete(row),
            (row) => _ctx.db.world_character.insert(row),
            nextRow,
        );
    },
);

export const touch_world_character = control_plane.reducer(
    {
        world_character_id: t.string(),
        last_seen_at: t.u64().optional(),
    },
    (ctx, payload) => {
        const world_character_id = requiredText("world_character_id", payload.world_character_id);
        const existing = ctx.db.world_character.world_character_id.find(world_character_id);
        if (!existing) {
            throw new SenderError(`world_character ${world_character_id} does not exist`);
        }
        return upsertRow(
            existing,
            (row) => ctx.db.world_character.delete(row),
            (row) => ctx.db.world_character.insert(row),
            {
                ...existing,
                last_seen_at: payload.last_seen_at ?? ctx.timestamp.microsSinceUnixEpoch,
            },
        );
    },
);

export const put_player_snapshot = control_plane.reducer(playerSnapshotColumns, (ctx, payload) => {
    const world_character_id = requiredText("world_character_id", payload.world_character_id);
    const nextRow = {
        ...payload,
        world_character_id,
        world_id: requiredText("world_id", payload.world_id),
        principal_id: requiredText("principal_id", payload.principal_id),
        persistent_vars_json: requiredText("persistent_vars_json", payload.persistent_vars_json),
        updated_at: ctx.timestamp.microsSinceUnixEpoch,
    };
    return upsertRow(
        ctx.db.player_snapshot.world_character_id.find(world_character_id),
        (row) => ctx.db.player_snapshot.delete(row),
        (row) => ctx.db.player_snapshot.insert(row),
        nextRow,
    );
});

export const put_agent_profile = control_plane.reducer(agentProfileColumns, (ctx, payload) => {
    const principal_id = requiredText("principal_id", payload.principal_id);
    const nextRow = {
        ...payload,
        principal_id,
        agent_id: requiredText("agent_id", payload.agent_id),
        display_name: requiredText("display_name", payload.display_name),
        persona_json: optionalText(payload.persona_json),
        controller_defaults_json: optionalText(payload.controller_defaults_json),
        updated_at: ctx.timestamp.microsSinceUnixEpoch,
    };
    return upsertRow(
        ctx.db.agent_profile.principal_id.find(principal_id),
        (row) => ctx.db.agent_profile.delete(row),
        (row) => ctx.db.agent_profile.insert(row),
        nextRow,
    );
});

export const put_agent_memory = control_plane.reducer(agentMemoryColumns, (ctx, payload) => {
    const memory_id = requiredText("memory_id", payload.memory_id);
    const nextRow = {
        ...payload,
        memory_id,
        principal_id: requiredText("principal_id", payload.principal_id),
        memory_scope: requiredText("memory_scope", payload.memory_scope),
        world_id: optionalText(payload.world_id),
        memory_key: requiredText("memory_key", payload.memory_key),
        value_json: requiredText("value_json", payload.value_json),
        updated_at: ctx.timestamp.microsSinceUnixEpoch,
    };
    return upsertRow(
        ctx.db.agent_memory.memory_id.find(memory_id),
        (row) => ctx.db.agent_memory.delete(row),
        (row) => ctx.db.agent_memory.insert(row),
        nextRow,
    );
});

export const put_trajectory_episode = control_plane.reducer(
    trajectoryEpisodeColumns,
    (ctx, payload) => {
        const episode_id = requiredText("episode_id", payload.episode_id);
        const nextRow = {
            ...payload,
            episode_id,
            world_id: requiredText("world_id", payload.world_id),
            principal_id: requiredText("principal_id", payload.principal_id),
            world_character_id: requiredText("world_character_id", payload.world_character_id),
            source: requiredText("source", payload.source),
            model: optionalText(payload.model),
            build_sha: optionalText(payload.build_sha),
            ended_at: payload.ended_at,
        };
        return upsertRow(
            ctx.db.trajectory_episode.episode_id.find(episode_id),
            (row) => ctx.db.trajectory_episode.delete(row),
            (row) => ctx.db.trajectory_episode.insert(row),
            nextRow,
        );
    },
);

export const put_trajectory_step = control_plane.reducer(trajectoryStepColumns, (_ctx, payload) => {
    const step_id = requiredText("step_id", payload.step_id);
    const nextRow = {
        ...payload,
        step_id,
        episode_id: requiredText("episode_id", payload.episode_id),
        observation_toon: optionalText(payload.observation_toon),
        action_kind: optionalText(payload.action_kind),
        action_toon: optionalText(payload.action_toon),
        outcome_toon: optionalText(payload.outcome_toon),
        reward_tags_json: optionalText(payload.reward_tags_json),
    };
    return upsertRow(
        _ctx.db.trajectory_step.step_id.find(step_id),
        (row) => _ctx.db.trajectory_step.delete(row),
        (row) => _ctx.db.trajectory_step.insert(row),
        nextRow,
    );
});

export const append_live_event = control_plane.reducer(liveEventColumns, (ctx, payload) => {
    return ctx.db.live_event.insert({
        ...payload,
        event_id: requiredText("event_id", payload.event_id),
        world_id: optionalText(payload.world_id),
        principal_id: optionalText(payload.principal_id),
        world_character_id: optionalText(payload.world_character_id),
        event_kind: requiredText("event_kind", payload.event_kind),
        payload_json: optionalText(payload.payload_json),
        created_at: payload.created_at ?? ctx.timestamp.microsSinceUnixEpoch,
    });
});

export const enqueue_scheduled_job = control_plane.reducer(
    {
        job_id: t.string(),
        world_id: t.string().optional(),
        job_kind: t.string(),
        payload_json: t.string(),
        delay_millis: t.u64(),
    },
    (ctx, payload) => {
        const job_id = requiredText("job_id", payload.job_id);
        return upsertRow(
            ctx.db.scheduled_job.job_id.find(job_id),
            (row) => ctx.db.scheduled_job.delete(row),
            (row) => ctx.db.scheduled_job.insert(row),
            {
                job_id,
                schedule_at: ScheduleAt.interval(payload.delay_millis * 1000n),
                world_id: optionalText(payload.world_id),
                job_kind: requiredText("job_kind", payload.job_kind),
                payload_json: requiredText("payload_json", payload.payload_json),
                created_at: ctx.timestamp.microsSinceUnixEpoch,
            },
        );
    },
);

export const drain_scheduled_job = control_plane.reducer(
    scheduledJobReducerParams,
    (ctx, { job }) => {
        if (!ctx.senderAuth.isInternal) {
            throw new SenderError("drain_scheduled_job is reserved for scheduled execution");
        }

        const existing = ctx.db.scheduled_job.job_id.find(job.job_id);
        if (existing) {
            ctx.db.scheduled_job.delete(existing);
        }
        ctx.db.live_event.insert({
            event_id: `${job.job_id}:fired`,
            world_id: optionalText(job.world_id),
            principal_id: undefined,
            world_character_id: undefined,
            event_kind: "scheduled_job_fired",
            payload_json: job.payload_json,
            created_at: ctx.timestamp.microsSinceUnixEpoch,
        });
    },
);

drain_scheduled_job_ref = drain_scheduled_job;

export const register_world_package = control_plane.reducer(worldPackageColumns, (ctx, payload) => {
    const package_id = requiredText("package_id", payload.package_id);
    const nextRow = {
        ...payload,
        package_id,
        owner_principal_id: requiredText("owner_principal_id", payload.owner_principal_id),
        slug: requiredText("slug", payload.slug),
        display_name: requiredText("display_name", payload.display_name),
        manifest_json: requiredText("manifest_json", payload.manifest_json),
        updated_at: ctx.timestamp.microsSinceUnixEpoch,
    };
    return upsertRow(
        ctx.db.world_package.package_id.find(package_id),
        (row) => ctx.db.world_package.delete(row),
        (row) => ctx.db.world_package.insert(row),
        nextRow,
    );
});

export const publish_world_release = control_plane.reducer(worldReleaseColumns, (ctx, payload) => {
    const release_id = requiredText("release_id", payload.release_id);
    const world_id = requiredText("world_id", payload.world_id);
    const nextRow = {
        ...payload,
        release_id,
        package_id: requiredText("package_id", payload.package_id),
        world_id,
        image_ref: requiredText("image_ref", payload.image_ref),
        revision: requiredText("revision", payload.revision),
        config_json: requiredText("config_json", payload.config_json),
    };
    const inserted = upsertRow(
        ctx.db.world_release.release_id.find(release_id),
        (row) => ctx.db.world_release.delete(row),
        (row) => ctx.db.world_release.insert(row),
        nextRow,
    );

    const existingWorld = ctx.db.world.world_id.find(world_id);
    if (existingWorld) {
        ctx.db.world.delete(existingWorld);
        ctx.db.world.insert({
            ...existingWorld,
            release_id,
            updated_at: ctx.timestamp.microsSinceUnixEpoch,
        });
    }

    return inserted;
});

export const put_world_patch = control_plane.reducer(worldPatchColumns, (_ctx, payload) => {
    const patch_id = requiredText("patch_id", payload.patch_id);
    const nextRow = {
        ...payload,
        patch_id,
        package_id: optionalText(payload.package_id),
        world_id: optionalText(payload.world_id),
        patch_kind: requiredText("patch_kind", payload.patch_kind),
        payload_json: requiredText("payload_json", payload.payload_json),
    };
    return upsertRow(
        _ctx.db.world_patch.patch_id.find(patch_id),
        (row) => _ctx.db.world_patch.delete(row),
        (row) => _ctx.db.world_patch.insert(row),
        nextRow,
    );
});

export const put_prefab = control_plane.reducer(prefabColumns, (ctx, payload) => {
    const prefab_id = requiredText("prefab_id", payload.prefab_id);
    const nextRow = {
        ...payload,
        prefab_id,
        owner_principal_id: requiredText("owner_principal_id", payload.owner_principal_id),
        name: requiredText("name", payload.name),
        prefab_kind: requiredText("prefab_kind", payload.prefab_kind),
        payload_json: requiredText("payload_json", payload.payload_json),
        updated_at: ctx.timestamp.microsSinceUnixEpoch,
    };
    return upsertRow(
        ctx.db.prefab.prefab_id.find(prefab_id),
        (row) => ctx.db.prefab.delete(row),
        (row) => ctx.db.prefab.insert(row),
        nextRow,
    );
});
