import {
    DbConnectionBuilder as BaseDbConnectionBuilder,
    DbConnectionImpl as BaseDbConnectionImpl,
    SubscriptionBuilderImpl as BaseSubscriptionBuilderImpl,
    convertToAccessorMap,
    makeQueryBuilder,
    procedureSchema,
    procedures,
    reducerSchema,
    reducers,
    schema,
    t,
    table,
    type DbConnectionConfig,
    type ErrorContextInterface,
    type EventContextInterface,
    type Infer,
    type QueryBuilder,
    type ReducerEventContextInterface,
    type RemoteModule,
    type SubscriptionEventContextInterface,
    type SubscriptionHandleImpl,
} from "spacetimedb";

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
    save_key: t.string().optional(),
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

const trajectoryEpisodeColumns = {
    episode_id: t.string().primaryKey(),
    world_id: t.string(),
    principal_id: t.string(),
    world_character_id: t.string(),
    agent_id: t.string(),
    player_id: t.u32(),
    session_source: t.string(),
    metadata_json: t.string().optional(),
    started_at: t.u64(),
    ended_at: t.u64().optional(),
};

const trajectoryStepColumns = {
    step_id: t.string().primaryKey(),
    episode_id: t.string(),
    world_id: t.string(),
    principal_id: t.string(),
    world_character_id: t.string(),
    player_id: t.u32(),
    sequence: t.u32(),
    event_kind: t.string(),
    action_name: t.string().optional(),
    correlation_id: t.string().optional(),
    observation_json: t.string().optional(),
    payload_json: t.string().optional(),
    outcome_json: t.string().optional(),
    recorded_at: t.u64(),
};

const liveEventColumns = {
    event_id: t.string().primaryKey(),
    world_id: t.string(),
    principal_id: t.string().optional(),
    world_character_id: t.string().optional(),
    player_id: t.u32().optional(),
    source: t.string(),
    event_name: t.string(),
    payload_json: t.string(),
    recorded_at: t.u64(),
};

const tablesSchema = schema({
    world: table({ name: "world", public: true }, worldColumns),
    principal: table({ name: "principal" }, principalColumns),
    login_account: table({ name: "login_account" }, loginAccountColumns),
    world_character: table({ name: "world_character" }, worldCharacterColumns),
    player_snapshot: table({ name: "player_snapshot" }, playerSnapshotColumns),
    trajectory_episode: table({ name: "trajectory_episode" }, trajectoryEpisodeColumns),
    trajectory_step: table({ name: "trajectory_step" }, trajectoryStepColumns),
    live_event: table({ name: "live_event", public: true }, liveEventColumns),
});

const loginAccountRow = t.row("LoginAccountRow", loginAccountColumns);
const worldCharacterRow = t.row("WorldCharacterRow", worldCharacterColumns);
const playerSnapshotRow = t.row("PlayerSnapshotRow", playerSnapshotColumns);

const reducersSchema = reducers(
    reducerSchema("upsert_world", worldColumns),
    reducerSchema("upsert_principal", principalColumns),
    reducerSchema("upsert_login_account", loginAccountColumns),
    reducerSchema("touch_login_account", {
        username: t.string(),
        last_login_at: t.u64().optional(),
    }),
    reducerSchema("upsert_world_character", worldCharacterColumns),
    reducerSchema("touch_world_character", {
        world_character_id: t.string(),
        last_seen_at: t.u64().optional(),
    }),
    reducerSchema("put_player_snapshot", playerSnapshotColumns),
    reducerSchema("upsert_trajectory_episode", trajectoryEpisodeColumns),
    reducerSchema("put_trajectory_step", trajectoryStepColumns),
    reducerSchema("put_live_event", liveEventColumns),
);

const proceduresSchema = procedures(
    procedureSchema("list_login_accounts", {}, t.array(loginAccountRow)),
    procedureSchema("get_login_account", { username: t.string() }, loginAccountRow.optional()),
    procedureSchema(
        "get_world_character",
        { world_character_id: t.string() },
        worldCharacterRow.optional(),
    ),
    procedureSchema(
        "get_world_character_by_save_key",
        {
            world_id: t.string(),
            save_key: t.string(),
        },
        worldCharacterRow.optional(),
    ),
    procedureSchema(
        "list_world_characters_for_world",
        { world_id: t.string() },
        t.array(worldCharacterRow),
    ),
    procedureSchema(
        "get_player_snapshot",
        { world_character_id: t.string() },
        playerSnapshotRow.optional(),
    ),
    procedureSchema(
        "get_player_snapshot_by_save_key",
        {
            world_id: t.string(),
            save_key: t.string(),
        },
        playerSnapshotRow.optional(),
    ),
    procedureSchema(
        "list_player_snapshots_for_world",
        { world_id: t.string() },
        t.array(playerSnapshotRow),
    ),
);

const REMOTE_MODULE = {
    versionInfo: {
        cliVersion: "2.0.0" as const,
    },
    tables: tablesSchema.schemaType.tables,
    reducers: reducersSchema.reducersType.reducers,
    ...proceduresSchema,
} satisfies RemoteModule<
    typeof tablesSchema.schemaType,
    typeof reducersSchema.reducersType,
    typeof proceduresSchema
>;

export const tables: QueryBuilder<typeof tablesSchema.schemaType> =
    makeQueryBuilder(tablesSchema.schemaType);

export const reducerAccessors = convertToAccessorMap(reducersSchema.reducersType.reducers);

export type LoginAccountRow = Infer<typeof loginAccountRow>;
export type WorldCharacterRow = Infer<typeof worldCharacterRow>;
export type PlayerSnapshotRow = Infer<typeof playerSnapshotRow>;

export type EventContext = EventContextInterface<typeof REMOTE_MODULE>;
export type ReducerEventContext = ReducerEventContextInterface<typeof REMOTE_MODULE>;
export type SubscriptionEventContext = SubscriptionEventContextInterface<typeof REMOTE_MODULE>;
export type ErrorContext = ErrorContextInterface<typeof REMOTE_MODULE>;
export type SubscriptionHandle = SubscriptionHandleImpl<typeof REMOTE_MODULE>;

export class SubscriptionBuilder extends BaseSubscriptionBuilderImpl<typeof REMOTE_MODULE> {}

export class DbConnectionBuilder extends BaseDbConnectionBuilder<DbConnection> {}

export class DbConnection extends BaseDbConnectionImpl<typeof REMOTE_MODULE> {
    static builder = (): DbConnectionBuilder =>
        new DbConnectionBuilder(
            REMOTE_MODULE,
            (config: DbConnectionConfig<typeof REMOTE_MODULE>) => new DbConnection(config),
        );

    override subscriptionBuilder = (): SubscriptionBuilder => {
        return new SubscriptionBuilder(this);
    };
}
